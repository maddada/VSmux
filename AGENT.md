1. Don't run pnpm run install or vp run instll please. I will run it.

2. CDX_LOG comments: Please whenever you're working on a codebase. I want you to add comments describing the date of the change (must be in this format yyyy-MM-dd-hh:mm) and describing the requirements or the change in requirements that made you implement certain functionality.
   I want you to write CDXC:Area-of-product in front of all your comments so they can be grepped.
   Most of this should be written as jsdocs but you can add short comments around for the important variables and more complex parts of the codebase.
   The idea is to encode the requiements of the system (especially software behavior, UX, and important technical decisions) into the code so it's clearer later why a certain piece of code was written.
   Always make sure to keep these comments updated as you work in the codebase and requirements change.
   Use technical writing principles to write non-verbose comments that convey the important info without fluff.
   Keep in mind that ALL of the important user facing requirements sent by the user must be written as comments somewhere in the codebase.

## Please never generate fallbacks when the right solution is to actually correct the behavior itself to fix the issue. Fallbacks should be used in rare cases only because they add complexity and hide issues and introduce useless logic.

### Example of what not to do:

Agent: I found the likely root cause: the Ghostty/Restty path is generating local font sources from your configured terminal font family, and VS Code webviews are blocking the local-fonts permission. I'm patching that helper to fall back cleanly instead of passing unusable local-font sources into Restty.

### Example of what you should do instead:

User: can we make it not fall back but instead just do the right thing from the start?

Agent: Yes. The clean fix is to stop generating local font sources at all when the current webview environment can't use the local-fonts capability. I'm wiring that check into the Restty font-source helper so Ghostty starts in the correct mode instead of trying-and-failing first.
