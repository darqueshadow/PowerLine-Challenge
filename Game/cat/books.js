/* ===========================================================================
   THE SHELF — the six books that stand above the corner C64's bench.

   Data only, exactly as disks.js is the disk roster: cat.js knows how to draw
   a book and turn a page, and does not know the name of a single one of them.
   🚫 No module, no build step (see cat.js) — one global, set by a plain script.

   ⭐ EVERY WORD HERE IS ORIGINAL, written for this station. That is his ruling
   of 2026-09-16, and it is the whole point: *"skip sourcing/including the
   external C64-era books entirely (even the confirmed-clear ones). Instead,
   write a short original, in-universe manual page — no copyright surface at
   all."* 🚫 Nothing here may quote a real manual, book or magazine listing. If
   a page ever needs to grow, write the new words; do not fetch them.
   📌 This file SHIPS TO THE PUBLIC PAGES SITE (it is runtime code, not a .md,
   so the deploy's exclude list does not catch it). That is fine precisely
   because it is all original — and it is the reason it must stay that way.

   ⚠️ THE SPINES ARE SHARED WITH ANOTHER TRACK. `spine` must match the Nerva
   Beacon room's shelf (`c64Shelf()` in the corridor's app.js) line for line:
   the player clicks a spine in the room and expects that book to open here.
   The brief that carries both halves is Brief_C64-Book-Reader_2026-09-16.md.

   ⚠️ PHOTOSENSITIVITY. Nothing in these listings flashes the screen. Book 3's
   one colour change repeats on a half-second delay, on the BORDER only. Keep
   it that way: a page edited into a fast full-screen flash is a hazard, not a
   demo. The FOR T loops are the wait — making them shorter is the mistake.

   ⭐ `id` IS A LINK TOKEN. The hub is reached as `?cart=<token>` (see "THE LINK"
   in cat.js), one opaque string the shell must not interpret, and a book's
   token is `book` + this id. So an id must be `^[a-z]+$`, like a cartridge's,
   and must not collide with one. 🚫 Renaming an id breaks that spine's click.
   ========================================================================= */
window.CAT_BOOKS = [

  /* ---------------------------------------------------------------------- */
  {
    id: "manual",
    title: "CAT COMPUTER · OPERATOR'S MANUAL",
    spine: ["CAT", "OPERATOR'S MANUAL"],
    imprint: "Rec-Bay 4 issue, Station Systems Office",
    tint: "#e8dfc0", ink: "#2b2418",          /* cream */
    pages: [
      {
        title: "Welcome aboard",
        blocks: [
          { p: "This CAT computer belongs to Rec-Bay 4. It is not station equipment, and Maintenance will not fix it. Treat it kindly." },
          { p: "When it starts, it says READY. and a cursor blinks. Anything you type is BASIC. Press RETURN at the end of a line." },
          { p: "If it stops answering, hold RUN/STOP and tap RESTORE. If that fails, the power switch is on the right-hand side. Never use the power switch while the drive light is on." }
        ]
      },
      {
        title: "Disks",
        blocks: [
          { p: "Put a disk in drive 8, label up, and close the latch. Then:" },
          { code: ['LOAD"$",8', "LIST"] },
          { p: "That shows what is on the disk. To load a program by its name:" },
          { code: ['LOAD"NAME",8,1', "RUN"] },
          { p: "The red light on the drive means it is busy. Wait for it to go out." }
        ]
      },
      {
        title: "House rules",
        blocks: [
          { p: "No coffee on the bench. The joystick in port 2 is the good one. Blank disks are in the parts tin." },
          { p: "If you write something worth keeping, save it before the shift ends:" },
          { code: ['SAVE"MYPROG",8'] },
          { p: "The note on the wall that says POKE 53280,0 is not a joke. Try it." }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "nightshift",
    title: "BASIC ON THE NIGHT SHIFT",
    spine: ["BASIC ON THE", "NIGHT SHIFT"],
    imprint: "Nerva Press",
    tint: "#9e3b2e", ink: "#f6e7d8",          /* brick red */
    pages: [
      {
        title: "Your first program",
        blocks: [
          { code: ['10 PRINT "HELLO, REC-BAY 4"', "20 GOTO 10", "RUN"] },
          { p: "Line numbers set the order. RUN starts it and RUN/STOP stops it. LIST shows what you typed. To change a line, type it again with the same number." }
        ]
      },
      {
        title: "Remembering things",
        blocks: [
          { code: ['10 INPUT "YOUR NAME";N$', '20 INPUT "HOURS LEFT ON SHIFT";H', '30 PRINT N$;", ONLY";H*60;"MINUTES TO GO"'] },
          { p: "A name ending in $ holds words. One without holds a number." }
        ]
      },
      {
        title: "Loops and decisions",
        blocks: [
          { code: ["10 FOR C=1 TO 10", '20 PRINT "CALL";C;"CLEARED"', "30 NEXT C", '40 PRINT "BREAK TIME"'] },
          { p: "Then type NEW to clear it, and try:" },
          { code: ['10 INPUT "GUESS A NUMBER 1-9";G', '20 IF G=7 THEN PRINT "LUCKY SEVEN": END', '30 PRINT "NOPE": GOTO 10'] }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "peekpoke",
    title: "PEEK & POKE",
    spine: ["PEEK & POKE"],
    imprint: "Nerva Press",
    tint: "#c8992e", ink: "#2b2207",          /* mustard */
    pages: [
      {
        title: "Colours",
        blocks: [
          { code: ["POKE 53280,0", "POKE 53281,0", "POKE 646,5"] },
          { p: "53280 is the border, 53281 the background, and 646 the colour of what you type next. The colours run from 0 to 15: 0 black, 1 white, 2 red, 5 green, 6 blue, 7 yellow, 14 light blue." }
        ]
      },
      {
        title: "Red alert (the border only)",
        blocks: [
          { code: ["10 FOR I=1 TO 10", "20 POKE 53280,2", "30 FOR T=1 TO 500: NEXT", "40 POKE 53280,0", "50 FOR T=1 TO 500: NEXT", "60 NEXT I"] },
          { p: "The FOR T loops are the wait. Make them longer to go slower. Keep them long: fast flashing is not kind to anyone's eyes." }
        ]
      },
      {
        title: "Writing to the screen yourself",
        blocks: [
          { code: ["10 PRINT CHR$(147): PRINT", "20 POKE 1024,1: POKE 55296,7", "30 PRINT PEEK(53280) AND 15"] },
          { p: "(The extra PRINT in line 10 moves the cursor down a line, so line 30's answer does not land on top of the A.)" },
          { p: "1024 is the top-left corner of the screen, and 1 is the letter A. 55296 is that corner's colour: 7 is yellow. PEEK reads a number back out of memory." }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "sprites",
    title: "SPRITES IN ORBIT",
    spine: ["SPRITES IN ORBIT"],
    imprint: "Nerva Press",
    tint: "#6b3a63", ink: "#f0dcee",          /* plum */
    pages: [
      {
        title: "A block in space",
        blocks: [
          { code: ["10 V=53248", "20 POKE 2040,13", "30 FOR I=0 TO 62: POKE 832+I,255: NEXT", "40 POKE V+39,7", "50 POKE V,160: POKE V+1,140", "60 POKE V+21,1"] },
          { p: "A sprite is a 24 × 21 picture the machine moves for you. Line 20 says where its picture is kept, line 30 fills it in, 39 sets its colour, V and V+1 its position, and V+21 switches it on." }
        ]
      },
      {
        title: "Into orbit",
        blocks: [
          { p: "Add these lines to the program on page 1:" },
          { code: ["70 FOR X=24 TO 250", "80 POKE V,X", "90 NEXT X", "100 GOTO 70"] },
          { p: "It goes round forever. RUN/STOP stops it." }
        ]
      },
      {
        title: "A better shape",
        blocks: [
          { p: "Type line 30 again as it is here, and add the DATA lines:" },
          { code: [
            "30 FOR I=0 TO 62: READ D: POKE 832+I,D: NEXT",
            "200 DATA 0,24,0,0,60,0,0,126,0,0,255,0",
            "210 DATA 1,255,128,3,255,192,7,255,224",
            "220 DATA 15,255,240,31,255,248,63,255,252",
            "230 DATA 127,255,254,63,255,252,31,255,248",
            "240 DATA 15,255,240,7,255,224,3,255,192",
            "250 DATA 1,255,128,0,255,0,0,126,0",
            "260 DATA 0,60,0,0,24,0"
          ] },
          { p: "Each row of the picture is three numbers, and there are 21 rows. This one is a diamond: a beacon." }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "sid",
    title: "MAKE THE SID SING",
    spine: ["MAKE THE SID SING"],
    imprint: "Nerva Press",
    tint: "#c4632a", ink: "#fbe9d8",          /* burnt orange */
    pages: [
      {
        title: "One note",
        blocks: [
          { code: ["10 S=54272", "20 FOR I=0 TO 24: POKE S+I,0: NEXT", "30 POKE S+24,15", "40 POKE S+5,9: POKE S+6,0", "50 POKE S+1,28: POKE S,214", "60 POKE S+4,33", "70 FOR T=1 TO 300: NEXT", "80 POKE S+4,32"] },
          { p: "Line 20 silences the sound chip, and 30 turns the volume up. 40 shapes the note, 50 sets its pitch, 60 starts it and 80 lets it go." }
        ]
      },
      {
        title: "The alarm (press any key to stop)",
        blocks: [
          { code: ["10 S=54272: POKE S+24,15", "20 POKE S+5,0: POKE S+6,240", "30 POKE S+4,17", "40 FOR F=20 TO 60: POKE S+1,F: NEXT", "50 FOR F=60 TO 20 STEP -1: POKE S+1,F: NEXT", '60 GET K$: IF K$="" THEN 40', "70 POKE S+4,16"] }
        ]
      },
      {
        title: "A tune",
        blocks: [
          { code: ["10 S=54272: FOR I=0 TO 24: POKE S+I,0: NEXT", "20 POKE S+24,15: POKE S+5,9: POKE S+6,0", "30 READ H,L,D: IF H<0 THEN END", "40 POKE S+1,H: POKE S,L", "50 POKE S+4,17", "60 FOR T=1 TO D: NEXT", "70 POKE S+4,16", "80 GOTO 30", "90 DATA 17,105,150,21,240,150,26,22,150", "100 DATA 21,240,150,17,105,150,26,22,400", "110 DATA -1,0,0"] },
          { p: "Each note is three numbers: two for the pitch and one for how long it lasts. Make up your own." }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: "machinecode",
    title: "MACHINE CODE AFTER MIDNIGHT",
    spine: ["MACHINE CODE", "AFTER MIDNIGHT"],
    imprint: "Nerva Press",
    tint: "#1a1712", ink: "#ffb347",          /* black with amber type */
    pages: [
      {
        title: "Four bytes",
        blocks: [
          { code: ["10 FOR I=0 TO 3: READ B: POKE 49152+I,B: NEXT", "20 DATA 238,32,208,96", "30 SYS 49152"] },
          { p: "49152 is free memory that BASIC leaves alone. 238, 32, 208 tell the processor to add one to the border colour, and 96 tells it to go back to BASIC. Type SYS 49152 again, and the border moves on one more colour." }
        ]
      },
      {
        title: "The whole screen at once",
        blocks: [
          { code: ["10 FOR I=0 TO 33: READ B: POKE 49152+I,B: NEXT", "20 SYS 49152", "30 DATA 162,0,169,81,157,0,4,157,0,5", "40 DATA 157,0,6,157,232,6,169,7,157,0", "50 DATA 216,157,0,217,157,0,218,157,232,218", "60 DATA 232,208,225,96"] },
          { p: "Thirty-four bytes fill every place on the screen with a yellow ball, faster than you can see." }
        ]
      },
      {
        title: "Now ask BASIC to do it",
        blocks: [
          { code: ["10 FOR I=1024 TO 2023: POKE I,81: NEXT"] },
          { p: "Count how long that takes. That wait is why people learn machine code." }
        ]
      }
    ]
  }
];
