# Rebuilds the Able2Love legal pages on one shared, on-brand template.
# Wording is preserved from the existing pages; only the shell changes.
import io, re, os

CONTACT = "abletoloveapp@gmail.com"

TABS = [
    ("privacy.html", "Privacy"),
    ("terms.html", "Terms"),
    ("community-guidelines.html", "Community"),
    ("safety.html", "Safety"),
    ("child-safety.html", "Child safety"),
]

SHELL = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Able2Love</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#16101B">
<link rel="icon" href="assets/profile-picture-1000x1000.png">
<link rel="stylesheet" href="assets/legal.css">
</head>
<body>
<header>
  <div class="bar">
    <a class="brand" href="./index.html" aria-label="Able2Love home">
      <img src="assets/logo-wordmark.png" alt="Able2Love">
    </a>
    <a class="nav-cta" href="https://play.google.com/store/apps/details?id=com.abletolove.app">Get the app</a>
  </div>
</header>

<div class="wrap">
  <div class="hero">
    <p class="label">{label}</p>
    <h1>{h1}</h1>
    <p class="sub">{sub}</p>
  </div>

  <nav class="tabs" aria-label="Legal and safety pages">
{tabs}
  </nav>
</div>

<main class="wrap">
  <div class="card">
{body}

    <div class="contact">
      <span class="k">Need a human?</span>
      <span>Email <a href="mailto:{contact}">{contact}</a> and Brogan reads it himself.</span>
    </div>
  </div>
</main>

<footer>
  <div class="wrap row">
    <span>&copy; 2026 Able2Love. Built in Greater Manchester.</span>
    <span><a href="./index.html">Back to Able2Love</a></span>
  </div>
</footer>
</body>
</html>
"""


def tabs_html(current):
    out = []
    for href, name in TABS:
        cur = ' aria-current="page"' if href == current else ""
        out.append('    <a href="./%s"%s>%s</a>' % (href, cur, name))
    return "\n".join(out)


def extract(fn):
    """Pull the human-written content out of an existing page."""
    s = io.open(fn, encoding="utf-8").read()
    m = re.search(r'<div class="wrap">(.*?)</div>\s*</body>', s, re.S)
    body = m.group(1)
    body = re.sub(r'<a class="back".*?</a>\s*', "", body, flags=re.S)
    h1 = re.search(r"<h1>(.*?)</h1>", body, re.S)
    sub = re.search(r'<p class="muted">(.*?)</p>', body, re.S)
    body = re.sub(r"<h1>.*?</h1>\s*", "", body, count=1, flags=re.S)
    body = re.sub(r'<p class="muted">.*?</p>\s*', "", body, count=1, flags=re.S)
    # the old grey "working draft" note no longer fits the new contact block
    body = re.sub(r'<div class="note">.*?</div>\s*', "", body, flags=re.S)
    return h1.group(1).strip(), sub.group(1).strip(), body.strip()


def indent(html, pad="    "):
    return "\n".join(pad + ln if ln.strip() else ln for ln in html.split("\n"))


def write(fn, label, h1, sub, body, desc):
    html = SHELL.format(
        title=h1, desc=desc, label=label, h1=h1, sub=sub,
        tabs=tabs_html(fn), body=indent(body), contact=CONTACT,
    )
    io.open(fn, "w", encoding="utf-8", newline="\n").write(html)
    print("wrote", fn, len(html), "bytes")


LABELS = {
    "privacy.html": ("Legal", "How Able2Love handles your data."),
    "terms.html": ("Legal", "The terms you agree to by using Able2Love."),
    "safety.html": ("Looking after each other", "Sensible habits that keep dating fun."),
}

for fn in ["privacy.html", "terms.html", "safety.html"]:
    h1, sub, body = extract(fn)
    label, desc = LABELS[fn]
    write(fn, label, h1, sub, body, desc)

# --- Community Guidelines: carried over from the Google Sites version ---
COMMUNITY = """<h2>The short version</h2>
<p>Able2Love only works if it feels safe. Treat people the way you would want your own message answered. If you would not say it to someone in a pub with their friends around them, do not type it here.</p>

<h2>Be a person, not a collector</h2>
<ul>
  <li><strong>No fetishising.</strong> Wanting to date a disabled person is welcome. Treating someone's disability as the attraction, or as a thing to try, is not. This is the fastest way to get removed.</li>
  <li><strong>No twenty questions about someone's body.</strong> If they want you to know, they will tell you. Access needs on a profile are there to make life easier, not to open an interrogation.</li>
  <li><strong>No inspiration talk.</strong> Nobody here is brave for existing, and telling someone they are is not the compliment it sounds like.</li>
</ul>

<h2>Not allowed, at all</h2>
<ul>
  <li>Harassment, threats, hate speech, or slurs about disability, race, gender, sexuality, religion or anything else.</li>
  <li>Unsolicited sexual images or messages.</li>
  <li>Anyone under 18, anywhere on the app.</li>
  <li>Pretending to be someone you are not, including using photos that are not yours.</li>
  <li>Asking people for money, promoting a business, or recruiting for anything.</li>
  <li>Sharing someone's private information or photographs without their permission.</li>
</ul>

<h2>Reporting</h2>
<p>Every profile and every chat has a report tool. Reporting is private, and the person you report is never told who did it. You can block anyone at any time and they disappear from your side of the app.</p>
<p>Reports are read by a human. Where something breaks these guidelines we remove the content, and where it is serious we remove the account, first time, no warning.</p>

<h2>If we get it wrong</h2>
<p>If your account is actioned and you believe it was a mistake, email and say so. A person will look again properly.</p>"""

write("community-guidelines.html", "Community",
      "Community Guidelines",
      "How we expect people to behave here, and what happens when they do not.",
      COMMUNITY,
      "The rules that keep Able2Love a safe, non fetishising place to date.")

# --- Child Safety Standards: wording preserved from the published version ---
CHILD = """<h2>Zero tolerance</h2>
<p>Able2Love has zero tolerance for child sexual abuse and exploitation, including child sexual abuse material. Although our service is strictly for adults, protecting children is a responsibility we take extremely seriously.</p>

<h2>Adults only</h2>
<p>Able2Love is exclusively for people aged 18 and over. Every user must confirm they are 18 or older to create an account. We do not knowingly permit anyone under 18 to use the app, and we remove any account we believe belongs to a minor.</p>

<h2>Prohibited content and conduct</h2>
<p>We strictly prohibit and act against any content or behaviour that sexualises children or facilitates child sexual abuse or exploitation, including child sexual abuse material, grooming, or any attempt to contact, exploit or harm a minor.</p>

<h2>Reporting</h2>
<p>Any user can report concerns directly in the app using the Report tool available on every profile and in every chat. Reports relating to child safety are treated as our highest priority.</p>

<h2>Our response</h2>
<p>We review child safety reports promptly. Where we identify child sexual abuse or exploitation, we remove the content, ban the user, preserve relevant information, and report to the appropriate authorities, including the National Center for Missing &amp; Exploited Children and local law enforcement, as required by law.</p>

<h2>Compliance</h2>
<p>We comply with applicable child safety laws and with Google Play's Child Safety Standards policy.</p>"""

write("child-safety.html", "Child safety",
      "Child Safety Standards",
      "Last updated: 8 June 2026.",
      CHILD,
      "Able2Love's child safety standards and reporting process.")
