from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, simpledialog
from datetime import datetime
from typing import Any

# SweetCord desktop UI sandbox.
# Standard library only: the demo never contacts Discord or sends local messages
# anywhere. Real Discord access must use an approved integration and official OAuth.

BG = "#0d0e13"
RAIL = "#101116"
PANEL = "#14151c"
PANEL_2 = "#191a23"
PANEL_3 = "#20212c"
LINE = "#292a36"
TEXT = "#f0edf8"
MUTED = "#9290a2"
SOFT = "#716e80"
PURPLE = "#ad9dff"
PURPLE_DARK = "#6553b2"
GREEN = "#86d6ae"


class SweetCordDemo:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("SweetCord — Lightweight Gaming Chat")
        self.root.geometry("1180x760")
        self.root.minsize(900, 560)
        self.root.configure(bg=BG)

        self.profile = {"name": "Squadmate", "username": "squadmate_demo", "initial": "S"}
        self.spaces: list[dict[str, Any]] = []
        self.active_space: str | None = None
        self.active_chat: tuple[str, str] = ("dm", "Night Squad")
        self.messages: dict[str, list[dict[str, str]]] = {}
        self.friends = [
            {"name": "Alex Rivera", "username": "alex_r", "initial": "A"},
            {"name": "Mika Chen", "username": "mika_gg", "initial": "M"},
            {"name": "Nova", "username": "nova.exe", "initial": "N"},
        ]
        self.dm_names = ["Night Squad", "Alex Rivera", "Mika Chen"]
        self.seed_demo_data()
        self.show_login()

    def seed_demo_data(self) -> None:
        self.messages["dm:Night Squad"] = [
            self.message("Nova", "N", "Anyone running one more match?", "17:41"),
            self.message("Alex Rivera", "A", "Yeah, give me two minutes to launch.", "17:42"),
            self.message("You", "S", "I'm in. Invite me when you're ready.", "17:43"),
        ]
        self.messages["dm:Alex Rivera"] = [
            self.message("Alex Rivera", "A", "Did you fix the frame drops?", "16:58"),
            self.message("You", "S", "Lowered the shadows. Much smoother now.", "17:01"),
        ]
        self.messages["dm:Mika Chen"] = [
            self.message("Mika Chen", "M", "Sent you the new build notes.", "Yesterday"),
        ]

    @staticmethod
    def message(author: str, initial: str, text: str, stamp: str | None = None) -> dict[str, str]:
        return {"author": author, "initial": initial, "text": text,
                "time": stamp or datetime.now().strftime("%H:%M")}

    def clear_root(self) -> None:
        for child in self.root.winfo_children():
            child.destroy()

    def label(self, parent: tk.Widget, text: str, *, size: int = 10,
              color: str = TEXT, bold: bool = False, **kwargs: Any) -> tk.Label:
        font = ("Segoe UI", size, "bold" if bold else "normal")
        widget = tk.Label(parent, text=text, bg=kwargs.pop("bg", parent.cget("bg")),
                          fg=color, font=font, anchor=kwargs.pop("anchor", "w"),
                          **kwargs)
        return widget

    def button(self, parent: tk.Widget, text: str, command: Any, *,
               bg: str = PANEL_2, fg: str = TEXT, active_bg: str = PANEL_3,
               padx: int = 11, pady: int = 8, font_size: int = 10,
               anchor: str = "center", **kwargs: Any) -> tk.Button:
        return tk.Button(
            parent, text=text, command=command, bg=bg, fg=fg,
            activebackground=active_bg, activeforeground=TEXT,
            disabledforeground=SOFT, relief="flat", bd=0, cursor="hand2",
            padx=padx, pady=pady, font=("Segoe UI", font_size),
            anchor=anchor, highlightthickness=0, **kwargs
        )

    def show_login(self) -> None:
        self.clear_root()
        outer = tk.Frame(self.root, bg=BG)
        outer.pack(fill="both", expand=True)
        header = tk.Frame(outer, bg=BG)
        header.pack(fill="x", padx=28, pady=20)
        mark = tk.Label(header, text="S", width=2, height=1, bg="#2e2742",
                        fg="#e1d7ff", font=("Segoe UI", 17, "bold"), padx=3, pady=2)
        mark.pack(side="left")
        self.label(header, "sweet", size=18, bold=True).pack(side="left", padx=(10, 0))
        self.label(header, "cord", size=18, color=PURPLE, bold=True).pack(side="left")
        self.label(header, "PYTHON DESKTOP PREVIEW", size=9, color=SOFT, bold=True).pack(side="right")

        center = tk.Frame(outer, bg=BG)
        center.pack(fill="both", expand=True)
        card = tk.Frame(center, bg=PANEL, highlightbackground=LINE, highlightthickness=1)
        card.place(relx=0.5, rely=0.47, anchor="center", width=480)
        card_content = tk.Frame(card, bg=PANEL)
        card_content.pack(fill="both", expand=True, padx=32, pady=30)

        tk.Label(card_content, text="◈", bg="#29243a", fg=PURPLE,
                 font=("Segoe UI Symbol", 24), width=3, height=1).pack(pady=(0, 18))
        self.label(card_content, "A LITTLE LESS NOISE", size=9, color=PURPLE, bold=True).pack()
        self.label(card_content, "Stay in the game.\nNot in the way.", size=27, bold=True,
                   justify="center", anchor="center").pack(pady=(12, 8))
        self.label(card_content, "A lightweight chat layout for players who want to keep\n"
                         "their focus—and system resources—on the game.",
                   size=10, color=MUTED, justify="center", anchor="center").pack(pady=(0, 22))

        self.button(card_content, "Launch local demo", self.open_demo, bg=PURPLE_DARK,
                    active_bg="#7866ca", padx=20, pady=12, font_size=11).pack(fill="x")
        self.button(card_content, "What is demo mode?", self.explain_demo, bg=PANEL_3,
                    fg="#d1cce0", padx=20, pady=10).pack(fill="x", pady=(9, 0))
        warning = ("This sandbox does not sign in to Discord or contact its API.\n"
                   "Never paste a Discord user token into a third-party app.")
        self.label(card_content, warning, size=9, color=SOFT, justify="center",
                   anchor="center", wraplength=400).pack(pady=(22, 0))
        footer = tk.Frame(outer, bg=BG)
        footer.pack(fill="x", side="bottom", padx=28, pady=12)
        self.label(footer, "SWEETCORD · COMMUNITY PROTOTYPE", size=8, color=SOFT, bold=True).pack(side="left")
        self.label(footer, "LOCAL DEMO ONLY  •  NO ACCOUNT DATA", size=8, color=SOFT, bold=True).pack(side="right")

    def explain_demo(self) -> None:
        messagebox.showinfo(
            "About local demo mode",
            "This is a local UI sandbox. It uses a sample profile and sample conversations. "
            "Messages you type stay in this process and are not sent to Discord or any server.\n\n"
            "For real Discord identity, use the official OAuth flow configured in the SweetCord "
            "web project. Access to Discord DMs and voice features requires approved integration "
            "permissions; a user token is not a supported shortcut."
        )

    def open_demo(self) -> None:
        self.active_space = None
        self.active_chat = ("dm", "Night Squad")
        self.render_app()

    def render_app(self) -> None:
        self.clear_root()
        self.root.configure(bg=BG)
        shell = tk.Frame(self.root, bg=BG)
        shell.pack(fill="both", expand=True)

        rail = tk.Frame(shell, bg=RAIL, width=68)
        rail.pack(side="left", fill="y")
        rail.pack_propagate(False)
        home_btn = self.button(rail, "S", lambda: self.go_home(), bg=PURPLE_DARK,
                               padx=0, pady=0, font_size=15, width=2, height=1)
        home_btn.pack(padx=12, pady=(14, 10), fill="x", ipady=5)
        tk.Frame(rail, bg=LINE, height=1).pack(fill="x", padx=18, pady=(0, 9))

        for space in self.spaces:
            active = self.active_space == space["id"]
            self.button(rail, space["initial"], lambda sid=space["id"]: self.open_space(sid),
                        bg="#403653" if active else PANEL_2,
                        fg="#ffffff" if active else "#c5c0d3",
                        padx=0, pady=0, font_size=10, width=2, height=1).pack(
                            padx=12, pady=4, fill="x", ipady=5)
        self.button(rail, "+", self.create_space, bg="#1a2824", fg=GREEN,
                    padx=0, pady=0, font_size=18, width=2).pack(padx=12, pady=(7, 4), fill="x")
        tk.Frame(rail, bg=RAIL).pack(fill="both", expand=True)
        self.button(rail, "?", self.explain_demo, bg=RAIL, fg=SOFT, padx=0, pady=5).pack(
            side="bottom", fill="x", padx=14, pady=12)

        side = tk.Frame(shell, bg=PANEL, width=255)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)
        top = tk.Frame(side, bg=PANEL)
        top.pack(fill="x", padx=15, pady=18)
        self.label(top, "sweet", size=17, bold=True).pack(side="left")
        self.label(top, "cord", size=17, color=PURPLE, bold=True).pack(side="left")
        self.label(top, "DEMO", size=8, color=SOFT, bold=True).pack(side="right", pady=5)
        tk.Frame(side, bg=LINE, height=1).pack(fill="x")

        if self.active_space is not None:
            self.render_space_sidebar(side)
        else:
            self.render_dm_sidebar(side)

        bottom = tk.Frame(side, bg="#101116")
        bottom.pack(side="bottom", fill="x", padx=11, pady=10)
        tk.Label(bottom, text="S", bg="#423557", fg="#e0d6ff", width=3,
                 font=("Segoe UI", 10, "bold"), pady=6).pack(side="left")
        usercopy = tk.Frame(bottom, bg="#101116")
        usercopy.pack(side="left", padx=8, fill="x", expand=True)
        self.label(usercopy, self.profile["name"], size=10, bold=True, bg="#101116").pack(anchor="w")
        self.label(usercopy, "@" + self.profile["username"], size=8,
                   color=SOFT, bg="#101116").pack(anchor="w")
        self.button(bottom, "↩", self.show_login, bg="#101116", fg=SOFT,
                    padx=5, pady=5).pack(side="right")

        main = tk.Frame(shell, bg=BG)
        main.pack(side="left", fill="both", expand=True)
        self.render_chat(main)

    def render_dm_sidebar(self, side: tk.Frame) -> None:
        actions = tk.Frame(side, bg=PANEL)
        actions.pack(fill="x", padx=12, pady=12)
        self.button(actions, "＋  New message", self.create_dm, bg=PANEL_3,
                    fg="#ded9ed", anchor="w", padx=10, pady=10).pack(fill="x")
        self.section_heading(side, "DIRECT MESSAGES")
        list_frame = tk.Frame(side, bg=PANEL)
        list_frame.pack(fill="x", padx=8)
        for name in self.dm_names:
            active = self.active_chat == ("dm", name)
            display = {"Night Squad": "Night Squad", "Alex Rivera": "Alex Rivera",
                       "Mika Chen": "Mika Chen"}.get(name, name)
            initial = display[:1].upper()
            row = tk.Frame(list_frame, bg="#252332" if active else PANEL)
            row.pack(fill="x", pady=2)
            tk.Label(row, text=initial, bg="#423557", fg="#e0d6ff", width=2,
                     font=("Segoe UI", 10, "bold"), pady=6).pack(side="left", padx=(5, 8), pady=4)
            self.button(row, display, lambda n=name: self.open_dm(n),
                        bg="#252332" if active else PANEL, fg=TEXT if active else "#b4b0c1",
                        anchor="w", padx=0, pady=10).pack(side="left", fill="x", expand=True)
        self.section_heading(side, "FRIENDS")
        friend_list = tk.Frame(side, bg=PANEL)
        friend_list.pack(fill="x", padx=13)
        for friend in self.friends:
            row = tk.Frame(friend_list, bg=PANEL)
            row.pack(fill="x", pady=4)
            tk.Label(row, text=friend["initial"], bg="#292a35", fg="#c9c4d8",
                     width=2, font=("Segoe UI", 9, "bold"), pady=4).pack(side="left", padx=(0, 9))
            info = tk.Frame(row, bg=PANEL)
            info.pack(side="left", fill="x", expand=True)
            self.label(info, friend["name"], size=9, color="#d8d4e3").pack(anchor="w")
            self.label(info, "@" + friend["username"], size=8, color=SOFT).pack(anchor="w")
            self.button(row, "›", lambda n=friend["name"]: self.open_dm(n),
                        bg=PANEL, fg=SOFT, padx=5, pady=2).pack(side="right")

        self.button(side, "＋  Create a group DM", self.create_group_dm,
                    bg=PANEL, fg=PURPLE, anchor="w", padx=16, pady=10).pack(fill="x", side="bottom")

    def render_space_sidebar(self, side: tk.Frame) -> None:
        space = next((s for s in self.spaces if s["id"] == self.active_space), None)
        if not space:
            self.active_space = None
            return self.render_dm_sidebar(side)
        header = tk.Frame(side, bg=PANEL)
        header.pack(fill="x", padx=15, pady=18)
        self.label(header, "YOUR SERVER" if space["kind"] == "server" else "PRIVATE GROUP",
                   size=8, color=SOFT, bold=True).pack(anchor="w")
        self.label(header, space["name"], size=14, bold=True, wraplength=215).pack(anchor="w", pady=(6, 0))
        tk.Frame(side, bg=LINE, height=1).pack(fill="x")
        self.section_heading(side, "TEXT CHANNELS", command=lambda: self.create_channel(space))
        for channel in space["channels"]:
            active = self.active_chat == ("channel", space["id"] + ":" + channel)
            self.button(side, ("#  " + channel), lambda s=space["id"], c=channel: self.open_channel(s, c),
                        bg="#292535" if active else PANEL, fg="#dfd7ff" if active else "#aaa5b7",
                        anchor="w", padx=18, pady=8).pack(fill="x", padx=9, pady=1)
        self.button(side, "＋  Invite a friend", self.invite_friend,
                    bg=PANEL, fg=PURPLE, anchor="w", padx=16, pady=10).pack(side="bottom", fill="x")
        self.button(side, "←  Back to messages", self.go_home,
                    bg=PANEL, fg=SOFT, anchor="w", padx=16, pady=9).pack(side="bottom", fill="x")

    def section_heading(self, parent: tk.Widget, title: str, command: Any = None) -> None:
        bar = tk.Frame(parent, bg=PANEL)
        bar.pack(fill="x", padx=15, pady=12)
        self.label(bar, title, size=8, color=SOFT, bold=True).pack(side="left")
        if command is not None:
            self.button(bar, "+", command, bg=PANEL, fg=SOFT, padx=6, pady=0,
                        font_size=13).pack(side="right")

    def render_chat(self, main: tk.Frame) -> None:
        mode, key = self.active_chat
        title = key
        subtitle = "PRIVATE CONVERSATION" if mode == "dm" else "TEXT CHANNEL"
        if mode == "channel":
            space_id, channel_name = key.split(":", 1)
            space = next((s for s in self.spaces if s["id"] == space_id), None)
            title = "#" + channel_name
            subtitle = (space["name"] if space else "Your server") + "  /  TEXT CHANNEL"

        topbar = tk.Frame(main, bg="#111219")
        topbar.pack(fill="x", padx=19, pady=13)
        if mode == "channel":
            self.label(topbar, "#", size=17, color=SOFT, bold=True).pack(side="left", padx=(0, 10))
        else:
            initial = title[:1].upper()
            tk.Label(topbar, text=initial, bg="#423557", fg="#e0d6ff", width=2,
                     font=("Segoe UI", 10, "bold"), pady=5).pack(side="left", padx=(0, 10))
        title_frame = tk.Frame(topbar, bg="#111219")
        title_frame.pack(side="left", fill="x", expand=True)
        self.label(title_frame, title, size=11, bold=True, bg="#111219").pack(anchor="w")
        self.label(title_frame, subtitle, size=8, color=SOFT, bg="#111219").pack(anchor="w", pady=(2, 0))
        self.label(topbar, "⚡ LOW OVERHEAD", size=8, color=PURPLE, bold=True,
                   bg="#111219").pack(side="right")

        tk.Frame(main, bg=LINE, height=1).pack(fill="x")
        body = tk.Frame(main, bg=BG)
        body.pack(fill="both", expand=True)
        intro = tk.Frame(body, bg=BG)
        intro.pack(fill="x", padx=30, pady=25)
        self.label(intro, "SWEETCORD / LOCAL PREVIEW", size=8, color=PURPLE, bold=True).pack(anchor="w")
        self.label(intro, title if mode == "dm" else f"Welcome to {title}",
                   size=22, bold=True, bg=BG).pack(anchor="w", pady=(8, 3))
        self.label(intro, "Sample conversations for testing the interface. Your demo messages stay local.",
                   size=9, color=MUTED, bg=BG).pack(anchor="w")
        tk.Frame(body, bg=LINE, height=1).pack(fill="x", padx=30)

        message_area = tk.Frame(body, bg=BG)
        message_area.pack(fill="both", expand=True, padx=22, pady=(12, 6))
        canvas = tk.Canvas(message_area, bg=BG, bd=0, highlightthickness=0)
        scrollbar = tk.Scrollbar(message_area, orient="vertical", command=canvas.yview,
                                 bg=PANEL_2, troughcolor=BG, activebackground=PANEL_3)
        content_frame = tk.Frame(canvas, bg=BG)
        content_frame.bind("<Configure>", lambda _event: canvas.configure(scrollregion=canvas.bbox("all")))
        window_id = canvas.create_window((0, 0), window=content_frame, anchor="nw")
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(window_id, width=event.width))
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        thread_key = f"{mode}:{key}"
        current_messages = self.messages.setdefault(thread_key, [])
        for item in current_messages:
            self.render_message(content_frame, item)
        canvas.update_idletasks()
        canvas.yview_moveto(1.0)

        compose_shell = tk.Frame(main, bg=BG)
        compose_shell.pack(fill="x", padx=22, pady=(5, 10))
        self.label(compose_shell, "Message  ·  Enter to send  ·  Shift+Enter for a new line",
                   size=8, color=SOFT, bg=BG).pack(anchor="w", padx=5, pady=(0, 6))
        compose = tk.Frame(compose_shell, bg=PANEL_2, highlightbackground=LINE, highlightthickness=1)
        compose.pack(fill="x")
        text_box = tk.Text(compose, height=2, wrap="word", bg=PANEL_2, fg=TEXT,
                           insertbackground=TEXT, relief="flat", bd=0, padx=11, pady=10,
                           font=("Segoe UI", 10), undo=True)
        text_box.pack(side="left", fill="both", expand=True)
        text_box.insert("1.0", "")
        text_box.bind("<Return>", lambda event: self.send_from_box(event, text_box, thread_key))
        send_btn = self.button(compose, "➤", lambda: self.send_message(text_box, thread_key),
                               bg=PURPLE_DARK, active_bg="#7866ca", padx=14, pady=10,
                               font_size=13)
        send_btn.pack(side="right", fill="y", padx=7, pady=7)
        footer = tk.Frame(main, bg="#111219")
        footer.pack(fill="x", side="bottom", padx=0, pady=0)
        self.label(footer, "●  LOCAL DEMO  ·  NO DISCORD CONNECTION", size=8,
                   color=GREEN, bold=True, bg="#111219").pack(side="left")
        self.label(footer, "SWEETCORD COMMUNITY PROTOTYPE", size=8, color=SOFT,
                   bg="#111219").pack(side="right")

    def render_message(self, parent: tk.Frame, item: dict[str, str]) -> None:
        row = tk.Frame(parent, bg=BG)
        row.pack(fill="x", padx=9, pady=8)
        tk.Label(row, text=item["initial"], bg="#423557" if item["author"] == "You" else "#282a35",
                 fg="#e0d6ff" if item["author"] == "You" else "#d2cede", width=2,
                 font=("Segoe UI", 10, "bold"), pady=5).pack(side="left", anchor="n", padx=(0, 11))
        copy = tk.Frame(row, bg=BG)
        copy.pack(side="left", fill="x", expand=True)
        meta = tk.Frame(copy, bg=BG)
        meta.pack(fill="x")
        self.label(meta, item["author"], size=9, bold=True, bg=BG).pack(side="left")
        self.label(meta, item["time"], size=8, color=SOFT, bg=BG).pack(side="left", padx=9)
        self.label(copy, item["text"], size=10, color="#c4c0cf", bg=BG,
                   justify="left", anchor="w", wraplength=720).pack(anchor="w", fill="x", pady=(4, 0))

    def send_from_box(self, event: tk.Event, text_box: tk.Text, thread_key: str) -> str | None:
        if event.state & 0x0001:
            return None
        self.send_message(text_box, thread_key)
        return "break"

    def send_message(self, text_box: tk.Text, thread_key: str) -> None:
        value = text_box.get("1.0", "end-1c").strip()
        if not value:
            return
        if len(value) > 4000:
            messagebox.showwarning("Message too long", "Keep messages to 4,000 characters or fewer.")
            return
        self.messages.setdefault(thread_key, []).append(self.message("You", "S", value))
        self.render_app()

    def open_dm(self, name: str) -> None:
        if name not in self.dm_names:
            self.dm_names.append(name)
        self.active_space = None
        self.active_chat = ("dm", name)
        self.render_app()

    def go_home(self) -> None:
        self.active_space = None
        self.active_chat = ("dm", "Night Squad")
        self.render_app()

    def open_space(self, space_id: str) -> None:
        self.active_space = space_id
        space = next((s for s in self.spaces if s["id"] == space_id), None)
        if space and space["channels"]:
            self.active_chat = ("channel", space_id + ":" + space["channels"][0])
        self.render_app()

    def open_channel(self, space_id: str, channel: str) -> None:
        self.active_space = space_id
        self.active_chat = ("channel", space_id + ":" + channel)
        self.render_app()

    def create_dm(self) -> None:
        name = simpledialog.askstring("New direct message", "Choose a demo contact name:", parent=self.root)
        if name and name.strip():
            self.open_dm(name.strip()[:48])

    def create_group_dm(self) -> None:
        name = simpledialog.askstring("New group DM", "Give your demo group a name:", parent=self.root)
        if name and name.strip():
            self.open_dm(name.strip()[:48])

    def create_space(self) -> None:
        name = simpledialog.askstring("Create server or group", "Name this local demo space:", parent=self.root)
        if not name or not name.strip():
            return
        kind = messagebox.askyesno("Space type", "Create a private group?\n\nChoose No for a server.")
        space_id = f"local-{len(self.spaces) + 1}"
        clean_name = name.strip()[:48]
        self.spaces.append({"id": space_id, "name": clean_name, "initial": clean_name[:2].upper(),
                            "kind": "group" if kind else "server", "channels": ["chat" if kind else "general"]})
        self.open_space(space_id)

    def create_channel(self, space: dict[str, Any]) -> None:
        name = simpledialog.askstring("Create channel", "New channel name:", parent=self.root)
        if not name or not name.strip():
            return
        clean = "-".join(name.lower().strip().split())
        allowed = "".join(ch for ch in clean if ch.isalnum() or ch == "-")
        if len(allowed) < 2:
            messagebox.showwarning("Invalid channel", "Use at least two letters or numbers.")
            return
        if allowed not in space["channels"]:
            space["channels"].append(allowed[:40])
        self.open_channel(space["id"], allowed[:40])

    def invite_friend(self) -> None:
        names = "\n".join(friend["username"] for friend in self.friends)
        messagebox.showinfo("Demo invite", "Invites are simulated in local preview mode.\n\nDemo contacts:\n" + names)

    @staticmethod
    def placeholder(_event: tk.Event) -> None:
        return None


def main() -> None:
    root = tk.Tk()
    SweetCordDemo(root)
    root.mainloop()


if __name__ == "__main__":
    main()
