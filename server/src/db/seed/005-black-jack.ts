import { db } from "../connection.ts";
import { and, eq } from "drizzle-orm";
import {
  modules,
  moduleToFile,
  starterFiles,
} from "../schema/module-schema.ts";

const blackJackText1 = `# Black Jack

Black Jack, anyone? 

We'll build a simplified version of the classic card game: one player versus the dealer, no splitting, no insurance bets.

We'll split our code into three files:
- \`blackjack.py\`: The main program that runs the game loop.
- \`utils.py\`: Utility functions for getting the value of a hand, getting the player's bet, and getting the player's move.
- \`cards.py\`: Functions for creating and displaying a deck of cards.
`;
const blackJackText2 = `# Display Cards

Lucky you! Most of the code to create a deck of cards and display them already exists in \`cards.py\`. Take some time to explore it.
- How is each card represented?
- What's the first card created in the deck?
- What's the last card created in the deck?
- How does \`.format\` change a string?
`;

const blackJackText3 = `# Calculate Hand Value

Next let's build a function to calculate the value of a hand of cards. The function \`getHandValue\` in \`utils.py\` is a stub. It has a docstring that describes what it should do, but the function body is empty. Your job is to add logic to the function so that it works as described.

Once you think you have it working, test it by temporarily adding some code that prints its output. Try different inputs to make sure it works for all cases, including:
- A hand with multiple aces
- A hand that "busts" (goes over 21)
- A hand with face cards (J, Q, K)
- A hand with only number cards (2-10)
`;

const blackJackText4 = `# Finish the Display Code

Back in \`cards.py\`, let's write one more function: \`displayHands\`. This function should display the player's and dealer's hands. If \`showDealerHand\` is \`False\`, the dealer's first card should be hidden. If \`showDealerHand\` is \`True\`, all of the dealer's cards should be shown.

Be sure to test your code with a temporarily added print statement to make sure it works as expected.
`;

const blackJackText5 = `# Get Player's Bet and Move

Now let's implement the functions in \`utils.py\` to get the player's bet and move.
- \`getBet\`: This function should ask the player how much they want to bet for the round. It should ensure that the bet is a valid number and does not exceed the player's available money.
- \`getMove\`: This function should ask the player for their move: hit, stand, or double down (if the player has not already hit). It should validate the input and return the appropriate character ('H', 'S', or 'D').

Make a quick list of all the possible scenarios you need to handle for each function and test each of them.
`;

const blackJackText6 = `# Main Game Loop

Finally, it's time to implement the main game loop in \`blackjack.py\`. This function should:
  - Initialize the player's money.
  - Loop until the player runs out of money or chooses to quit.
  - For each round:
    - Create and shuffle a deck of cards.
    - Deal two cards each to the player and dealer.
    - Get the player's bet using \`getBet\`.
    - Allow the player to make moves (hit, stand, double down) using \`getMove\`.
    - Reveal the dealer's hand and let the dealer play according to the rules.
    - Determine the winner and adjust the player's money accordingly.
    - Display the player's current money.

Take it step by step, testing each part as you go. Good luck!
`;

const blackjack_py = `import random, sys

def main():
  print('''Blackjack, anyone?

  Rules:
    - Try to get as close to 21 without going over.
      - Kings, Queens, and Jacks are worth 10 points.
      - Aces are worth 1 or 11 points.
      - Cards 2 through 10 are worth their face value.

    - (H)it to take another card.
    - (S)tand to stop taking cards.
    - On your first play, you can (D)ouble down to increase your bet
      but must hit exactly one more time before standing.

    - In case of a tie, the bet is returned to the player.
    - The dealer stops hitting at 17.
  ''')
`;

const utils_py = `import sys

def getHandValue(cards):
    """Returns the value of the cards. Face cards are worth 10, aces are
    worth 11 or 1 (this function picks the most suitable ace value)."""
    pass


def getBet(maxBet):
    """Ask the player how much they want to bet for this round."""
    pass


def getMove(playerHand, money):
    """Asks the player for their move, and returns 'H' for hit, 'S' for
    stand, and 'D' for double down."""
    pass
`;

const cards_py = `import random
from utils import getHandValue

# Set up the constants:
HEARTS   = chr(9829)
DIAMONDS = chr(9830)
SPADES   = chr(9824)
CLUBS    = chr(9827)
BACKSIDE = 'backside'

def getDeck():
    """Return a shuffled list of (rank, suit) tuples for all 52 cards."""
    deck = []
    for suit in (HEARTS, DIAMONDS, SPADES, CLUBS):
        for rank in range(2, 11):
            deck.append((str(rank), suit))  # Add the numbered cards.
        for rank in ('J', 'Q', 'K', 'A'):
            deck.append((rank, suit))  # Add the face and ace cards.
    random.shuffle(deck)
    return deck

def displayCards(cards):
    """Display all the cards in the cards list."""
    rows = ['', '', '', '', '']  # The text to display on each row.

    # Repeat for each card in the list
    for i, card in enumerate(cards):
        rows[0] += ' ___  '  # Print the top line of the card.
        if card == BACKSIDE:
            # Print a card's back:
            rows[1] += '|## | '
            rows[2] += '|###| '
            rows[3] += '|_##| '
        else:
            # Print the card's front:
            rank, suit = card  # The card is a tuple data structure.
            rows[1] += '|{} | '.format(rank.ljust(2))
            rows[2] += '| {} | '.format(suit)
            rows[3] += '|_{}| '.format(rank.rjust(2, '_'))

    # Print each row on the screen:
    for row in rows:
        print(row)

def displayHands(playerHand, dealerHand, showDealerHand):
    """Show the player's and dealer's cards. Hide the dealer's first
    card if showDealerHand is False."""
    pass
`;

export async function run() {
  console.log("Seeding database...");

  // Insert modules but ignore if the slug already exists.
  await db
    .insert(modules)
    .values([
      {
        slug: "black-jack",
        name: "Black Jack",
        instructions: [
          { text: blackJackText1 },
          { text: blackJackText2 },
          { text: blackJackText3 },
          { text: blackJackText4 },
          { text: blackJackText5 },
          { text: blackJackText6 },
        ],
      },
    ])
    .onConflictDoNothing();

  // Now fetch the modules (whether newly created or pre-existing).
  const modulesInsert = [
    (
      await db
        .select()
        .from(modules)
        .where(eq(modules.slug, "black-jack"))
        .limit(1)
    )[0],
  ];

  await Promise.all(
    modulesInsert.map(async (mod) => {
      if (!mod) return;
      if (mod.slug === "black-jack") {
        let { fileId: file1ID } =
          (
            await db
              .select({ fileId: starterFiles.id })
              .from(starterFiles)
              .leftJoin(moduleToFile, eq(starterFiles.id, moduleToFile.fileId))
              .where(
                and(
                  eq(starterFiles.name, "blackjack.py"),
                  eq(moduleToFile.moduleId, mod.id),
                ),
              )
              .limit(1)
          )[0] || {};
        let { fileId: file2ID } =
          (
            await db
              .select({ fileId: starterFiles.id })
              .from(starterFiles)
              .leftJoin(moduleToFile, eq(starterFiles.id, moduleToFile.fileId))
              .where(
                and(
                  eq(starterFiles.name, "utils.py"),
                  eq(moduleToFile.moduleId, mod.id),
                ),
              )
              .limit(1)
          )[0] || {};
        let { fileId: file3ID } =
          (
            await db
              .select({ fileId: starterFiles.id })
              .from(starterFiles)
              .leftJoin(moduleToFile, eq(starterFiles.id, moduleToFile.fileId))
              .where(
                and(
                  eq(starterFiles.name, "cards.py"),
                  eq(moduleToFile.moduleId, mod.id),
                ),
              )
              .limit(1)
          )[0] || {};
        if (!file1ID) {
          const r = await db
            .insert(starterFiles)
            .values({
              name: "blackjack.py",
              content: blackjack_py,
            })
            .returning()
            .then((r) => r[0]);

          file1ID = r.id;
        }
        if (!file2ID) {
          const r = await db
            .insert(starterFiles)
            .values({
              name: "utils.py",
              content: utils_py,
            })
            .returning()
            .then((r) => r[0]);

          file2ID = r.id;
        }
        if (!file3ID) {
          const r = await db
            .insert(starterFiles)
            .values({
              name: "cards.py",
              content: cards_py,
            })
            .returning()
            .then((r) => r[0]);

          file3ID = r.id;
        }

        await db
          .insert(moduleToFile)
          .values({
            moduleId: mod.id,
            fileId: file1ID,
            sortOrder: 0,
            isEntryPoint: true,
            isActive: true,
          })
          .onConflictDoNothing();
        await db
          .insert(moduleToFile)
          .values({
            moduleId: mod.id,
            fileId: file2ID,
            sortOrder: 1,
            isEntryPoint: false,
            isActive: false,
          })
          .onConflictDoNothing();
        await db
          .insert(moduleToFile)
          .values({
            moduleId: mod.id,
            fileId: file3ID,
            sortOrder: 2,
            isEntryPoint: false,
            isActive: false,
          })
          .onConflictDoNothing();
      }
    }),
  );

  console.log("Seeding completed.");
}
