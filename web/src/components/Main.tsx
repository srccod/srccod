import { useParams } from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import CommandBar from "./CommandBar.tsx";
import Editor from "./Editor.tsx";
import { Resizable, ResizableHandle, ResizablePanel } from "./ui/resizable.tsx";
import { usePyodide } from "../hooks/usePyodide.ts";
import * as monaco from "monaco-editor";
import Instructions from "./Instructions.tsx";
import { getModuleBySlug, saveFiles } from "../lib/apiClient.ts";
import type { FileResponse } from "../../../server/src/shared-types.ts";

export default function Main() {
  const params = useParams();
  const [files, setFiles] = createSignal<FileResponse[]>([]);
  const [activeFile, setActiveFile] = createSignal("");

  let codeEditor: monaco.editor.IStandaloneCodeEditor | undefined;
  let outputEditor: monaco.editor.IStandaloneCodeEditor | undefined;

  const {
    isPyodideLoading,
    isExecuting,
    pyodideStream,
    setPyodideStream,
    isAwaitingInput,
    sendInput,
    filesUpdated,
    executePython,
    sendInterrupt,
  } = usePyodide();

  // auto-scroll output editor to bottom on new output or input prompt
  createEffect(() => {
    // subscribe to changes
    pyodideStream();
    isAwaitingInput();

    if (outputEditor) {
      const model = outputEditor.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        const lastLineLength = model.getLineContent(lineCount).length;
        const newPosition = {
          lineNumber: lineCount,
          column: lastLineLength + 1,
        };
        outputEditor.setPosition(newPosition);
        outputEditor.revealPosition(newPosition);
      }
    }
  });

  // focus output editor when waiting for input
  createEffect(() => {
    const isReadOnly = !isAwaitingInput();
    if (!outputEditor) return;

    outputEditor.updateOptions({ readOnly: isReadOnly });
    if (!isReadOnly) {
      outputEditor.focus();
    }
    const domNode = outputEditor.getDomNode();
    if (domNode) {
      if (isReadOnly) {
        domNode.classList.add("editor-readonly");
      } else {
        domNode.classList.remove("editor-readonly");
      }
    }
  });

  // refocus code editor when execution completes
  createEffect((prevIsExecuting) => {
    const currentIsExecuting = isExecuting();
    if (prevIsExecuting && !currentIsExecuting) {
      if (codeEditor) {
        codeEditor.focus();
      }
    }
    return currentIsExecuting;
  }, isExecuting());

  // set active file to entrypoint or first file when module loads
  createEffect(() => {
    const mod = module();
    if (mod && mod.files && mod.files.length > 0) {
      const entrypoint = mod.files.find((f) => f.isEntryPoint)?.name ||
        mod.files[0].name;
      setActiveFile(entrypoint);
    }
  });

  // merge files pushed from the worker during interactive execution
  createEffect(() => {
    const incoming = filesUpdated();
    if (!incoming) return;
    setFiles((prev) => {
      const updated = [...prev];
      for (const f of incoming) {
        const idx = updated.findIndex((pf) => pf.name === f.name);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], content: f.content };
        } else {
          updated.push({
            id: crypto.randomUUID(),
            name: f.name,
            content: f.content,
            isEntryPoint: false,
            sortOrder: updated.length,
          });
        }
      }
      return updated;
    });
  });

  // source for the resource: the slug from params
  const moduleSlug = () => params.slug || "default";

  // Fetcher function for the module
  const fetchModule = async (slug: string) => {
    if (!slug) return null; // Handle cases where slug might be empty
    try {
      const module = await getModuleBySlug(slug);
      setFiles(module.files || []);
      return module;
    } catch (err) {
      console.error("Failed to fetch module:", err);
      throw err; // Re-throw to let createResource handle the error state
    }
  };

  const [moduleData] = createResource(moduleSlug, fetchModule);

  // Derived signals for files and module (from moduleData)
  const module = () => moduleData();

  const handleRunCode = async () => {
    if (isPyodideLoading() || isExecuting()) {
      return;
    }
    try {
      const result = await executePython(files(), activeFile());
      if (result?.files) {
        setFiles((prev) => {
          const updated = [...prev];
          for (const f of result.files) {
            const idx = updated.findIndex((pf) => pf.name === f.name);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], content: f.content };
            } else {
              updated.push({
                id: crypto.randomUUID(),
                name: f.name,
                content: f.content,
                isEntryPoint: false,
                sortOrder: updated.length,
              });
            }
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("Python execution failed:", err);
    }
  };

  const handleSave = async () => {
    try {
      await saveFiles(
        files().map((f) => ({ id: f.id, name: f.name, content: f.content })),
      );
      console.log("Files saved successfully");
    } catch (err) {
      console.error("Failed to save files:", err);
    }
  };

  const handleUndo = () => {
    if (codeEditor) {
      codeEditor.trigger("", "undo", {});
    }
  };

  const handleRedo = () => {
    if (codeEditor) {
      codeEditor.trigger("", "redo", {});
    }
  };

  onMount(() => {
    const interval = setInterval(() => {
      handleSave();
    }, 30000); // auto-save every 30 seconds
    onCleanup(() => {
      clearInterval(interval);
    });
  });

  const activeFileContent = () =>
    files().find((f) => f.name === activeFile())?.content ?? "";

  return (
    <>
      <Show when={moduleData.loading}>
        <div>Loading module...</div>
      </Show>
      <Show when={moduleData.error}>
        <div class="text-red-500">Error: {moduleData.error.message}</div>
      </Show>
      <Show when={!moduleData.loading && !moduleData.error && module()}>
        <Resizable class="">
          <ResizablePanel initialSize={0.25} class="overflow-hidden">
            <Instructions module={module()} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel initialSize={0.75} class="overflow-hidden">
            <Resizable orientation="vertical">
              <ResizablePanel initialSize={0.5} class="overflow-hidden">
                <div class="h-full flex flex-col">
                  <CommandBar
                    onRun={handleRunCode}
                    onSave={handleSave}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onInterrupt={sendInterrupt}
                    isExecuting={isExecuting()}
                    files={files()}
                    activeFile={activeFile()}
                    setActiveFile={setActiveFile}
                  />
                  <div class="flex-1 overflow-hidden">
                    <Editor
                      controlled
                      value={activeFileContent()}
                      language="python"
                      theme="vs-dark"
                      uri={activeFile()}
                      onChange={(value) => {
                        const newFiles = files().map((f) =>
                          f.name === activeFile() ? { ...f, content: value } : f
                        );
                        setFiles(newFiles);
                      }}
                      onMount={(editor, _monaco) => {
                        codeEditor = editor;
                        editor.addAction({
                          id: "run-code",
                          label: "Run Code",
                          keybindings: [],
                          run: () => {
                            handleRunCode();
                          },
                        });
                        console.log("code editor mounted");
                      }}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel initialSize={0.5} class="overflow-hidden">
                <div class="h-full flex flex-col">
                  <div class="flex-1 overflow-hidden">
                    <Editor
                      controlled
                      value={pyodideStream()}
                      language="plaintext"
                      theme="vs-dark"
                      uri="output"
                      onMount={(editor, _monaco) => {
                        outputEditor = editor;
                        editor.onKeyDown((e) => {
                          if (isAwaitingInput() && e.code === "Enter") {
                            e.preventDefault();
                            const model = editor.getModel();
                            if (model) {
                              const currentValue = model.getValue();
                              const input = currentValue.substring(
                                pyodideStream().length,
                              );
                              sendInput(input);
                              setPyodideStream((prev) => prev + input + "\n");
                            }
                          }
                        });
                        console.log("output editor mounted");
                      }}
                      options={{
                        fontSize: 14,
                        lineNumbers: "off",
                        minimap: { enabled: false },
                        renderLineHighlight: "none",
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </Resizable>
          </ResizablePanel>
        </Resizable>
      </Show>
    </>
  );
}
