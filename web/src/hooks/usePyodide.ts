import { createSignal, onCleanup, onMount } from "solid-js";
import { generateID } from "../lib/generateID.ts";

// @ts-ignore: Vite worker import
import PyodideWorker from "../workers/pyodide.worker.ts?worker";

type WorkerMessage = {
  id: string;
  type: string;
  payload?: { files?: { name: string; content: string }[] };
  output?: string;
  error?: string;
  returnValue?: string;
};

const pendingPromises = new Map<
  string,
  {
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
  }
>();

const CONTROL_BYTE_LENGTH = 8;
const SHARED_MEM_SIZE = 256 * 1024; // 256 KB
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Write a string into the shared memory buffer for stdin.
 * @param sab The SharedArrayBuffer shared between main thread and worker
 * @param input The string to write (newline appended if missing)
 */
function writeInput(sab: SharedArrayBuffer, input: string) {
  const withNewLine = input.endsWith("\n") ? input : input + "\n";

  const bytes = textEncoder.encode(withNewLine);

  const control = new Int32Array(sab, 0, 2);
  const dataView = new Uint8Array(sab, CONTROL_BYTE_LENGTH);

  if (bytes.length > dataView.byteLength) {
    throw new Error("Input too large for shared memory buffer.");
  }

  // copy into shared buffer
  dataView.fill(0);
  dataView.set(bytes, 0);

  // record length & flag
  Atomics.store(control, 1, bytes.length); // length of data
  Atomics.store(control, 0, 1); // flag = 1 (data ready)

  // wake up the worker
  Atomics.notify(control, 0, 1);
}

export function usePyodide() {
  const [isPyodideLoading, setIsPyodideLoading] = createSignal(true);
  const [pyodideStream, setPyodideStream] = createSignal("");
  const [pyodideError, setPyodideError] = createSignal<string | null>(null);
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [isAwaitingInput, setIsAwaitingInput] = createSignal(false);
  const [filesUpdated, setFilesUpdated] = createSignal<{ name: string; content: string }[] | null>(null);

  let worker: Worker | undefined;
  let sharedMem: SharedArrayBuffer | undefined;
  let outputMem: SharedArrayBuffer | undefined;
  let outputInterval: number | undefined;
  let lastReadPos = 0;
  let interruptBuffer: Uint8Array | undefined;

  /**
   * Read output from the shared memory buffer for stdout/stderr.
   * @param sab The SharedArrayBuffer for output
   * @returns The string read, or null if no data
   */
  function readOutput(sab: SharedArrayBuffer): string | null {
    const control = new Int32Array(sab, 0, 3);
    const dataView = new Uint8Array(sab, 12);

    const flag = Atomics.load(control, 0);
    if (flag === 1) {
      const len = Atomics.load(control, 1);
      if (len < lastReadPos) {
        // Buffer was reset, reset lastReadPos
        lastReadPos = 0;
      }
      if (len > lastReadPos) {
        const bytes = new Uint8Array(len - lastReadPos);
        bytes.set(dataView.subarray(lastReadPos, len));
        const s = textDecoder.decode(bytes);
        lastReadPos = len;
        // Reset flag to 0
        Atomics.store(control, 0, 0);
        return s;
      }
    }
    return null;
  }

  onMount(() => {
    worker = new PyodideWorker();

    if (!worker || !(worker instanceof Worker)) {
      console.error("Failed to create Pyodide worker.");
      return;
    }

    sharedMem = new SharedArrayBuffer(SHARED_MEM_SIZE);
    outputMem = new SharedArrayBuffer(SHARED_MEM_SIZE);
    const interruptSab = new SharedArrayBuffer(1);
    interruptBuffer = new Uint8Array(interruptSab);

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { id, type, error } = event.data;

      if (type === "init-success") {
        setIsPyodideLoading(false);
        const initPromise = pendingPromises.get(id);
        if (initPromise) {
          initPromise.resolve(true);
          pendingPromises.delete(id);
        }
        return;
      }
      if (type === "init-error") {
        setIsPyodideLoading(false);
        setPyodideError(error || "Unknown Pyodide initialization error.");
        const initErrorPromise = pendingPromises.get(id);
        if (initErrorPromise) {
          initErrorPromise.reject(error);
          pendingPromises.delete(id);
        }
        return;
      }
      if (type === "input-request") {
        setIsAwaitingInput(true);
        return;
      }
      if (type === "execute-success") {
        setIsExecuting(false);
        setIsAwaitingInput(false);
        setPyodideError(null);
        const execPromise = pendingPromises.get(id);
        if (execPromise) {
          execPromise.resolve(event.data.payload);
          pendingPromises.delete(id);
        }
        return;
      }
      if (type === "execute-error") {
        setIsExecuting(false);
        setIsAwaitingInput(false);
        setPyodideError(error || "Unknown Python execution error.");
        setPyodideStream((prev) => prev + (error || "Unknown error") + "\n");
        const execErrorPromise = pendingPromises.get(id);
        if (execErrorPromise) {
          execErrorPromise.reject(error);
          pendingPromises.delete(id);
        }
        return;
      }
      if (type === "files-updated") {
        const files = event.data.payload?.files;
        if (files) {
          setFilesUpdated(files);
        }
        return;
      }
    };

    worker.onerror = (err) => {
      console.error("Pyodide Worker error:", err);
      setPyodideError("A critical error occurred in the Pyodide worker.");
      setIsPyodideLoading(false);
      setIsExecuting(false);
    };

    const initId = generateID();

    worker.postMessage({
      id: initId,
      type: "init",
      payload: { inputSab: sharedMem, outputSab: outputMem, interruptSab },
    });

    // Start polling for output
    outputInterval = setInterval(() => {
      if (outputMem) {
        const out = readOutput(outputMem);
        if (out) {
          setPyodideStream((prev) => prev + out);
        }
      }
    }, 5); // Poll every 10ms

    return new Promise((resolve, reject) => {
      pendingPromises.set(initId, { resolve, reject });
    });
  });

  onCleanup(() => {
    if (outputInterval) {
      clearInterval(outputInterval);
    }
    if (worker) {
      worker.terminate();
      worker = undefined;
    }
  });

  const executePython = (
    files: { name: string; content: string }[],
    entrypoint: string
  ): Promise<{ files: { name: string; content: string }[] } | undefined> => {
    if (!worker || isPyodideLoading()) {
      setPyodideError("Pyodide is not ready yet.");
      return Promise.reject("Pyodide is not ready yet.");
    }
    setIsExecuting(true);
    setPyodideStream("");
    setPyodideError(null);
    lastReadPos = 0;
    if (interruptBuffer) interruptBuffer[0] = 0;

    const id = generateID();

    return new Promise<{ files: { name: string; content: string }[] } | undefined>((resolve, reject) => {
      pendingPromises.set(id, {
        resolve: resolve as (value?: unknown) => void,
        reject: reject as (reason?: unknown) => void,
      });

      worker!.postMessage({
        id,
        type: "execute",
        payload: { files, entrypoint },
      });
    });
  };

  const sendInterrupt = () => {
    if (interruptBuffer) {
      interruptBuffer[0] = 2;
    }
  };

  const sendInput = (value: string) => {
    if (worker && isAwaitingInput() && sharedMem) {
      writeInput(sharedMem, value);
      setIsAwaitingInput(false);
    }
  };

  return {
    isPyodideLoading,
    isExecuting,
    pyodideStream,
    setPyodideStream,
    pyodideError,
    isAwaitingInput,
    setIsAwaitingInput,
    filesUpdated,
    executePython,
    sendInput,
    sendInterrupt,
  };
}
