#!/usr/bin/env python3
"""Parse the listing-add-mode region and verify tag balance."""
from html.parser import HTMLParser
import pathlib

src = pathlib.Path("client/public/broker_tool.html").read_text()
start = src.index('<div id="listing-add-mode">')
end = src.index('<!-- end listing-add-mode -->', start)
region = src[start:end]

VOID = {"input","br","hr","img","link","meta","source","track","wbr"}

class B(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack = []
        self.errors = []
    def handle_starttag(self, tag, attrs):
        if tag in VOID: return
        self.stack.append((tag, self.getpos()))
    def handle_startendtag(self, tag, attrs):
        pass
    def handle_endtag(self, tag):
        if tag in VOID: return
        if not self.stack:
            self.errors.append(("extra close", tag, self.getpos()))
            return
        top, pos = self.stack[-1]
        if top != tag:
            self.errors.append(("mismatch", tag, "expected", top, "open at", pos, "close at", self.getpos()))
            # try to pop until we find it
            while self.stack and self.stack[-1][0] != tag:
                self.stack.pop()
            if self.stack: self.stack.pop()
        else:
            self.stack.pop()

p = B()
p.feed(region)
print("errors:", len(p.errors))
for e in p.errors[:10]:
    print(e)
print("unclosed stack:", [x for x in p.stack])
