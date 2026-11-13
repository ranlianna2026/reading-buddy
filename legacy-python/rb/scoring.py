"""Read-aloud scoring by code (no model): align the speech transcript to the book passage.

Outputs words-correct-per-minute (WCPM), accuracy and miscues, the standard oral-reading-fluency measures.
Only the part the child actually reached is scored, so stopping early is not counted as errors.
"""
import re
from difflib import SequenceMatcher

_NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
        "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"}


def words(text):
    """Display tokens (keep punctuation) for the passage."""
    return text.split()


def norm(tok):
    t = re.sub(r"[^a-z0-9']", "", tok.lower().replace("’", "'")).strip("'")
    return _NUM.get(t, t)


def _close(a, b):
    return a == b or (len(a) > 3 and SequenceMatcher(None, a, b).ratio() >= 0.8)


def score(passage, transcript, seconds):
    disp = words(passage)
    ref = [norm(w) for w in disp]
    keep = [i for i, w in enumerate(ref) if w]          # skip pure-punctuation tokens
    ref_n = [ref[i] for i in keep]
    hyp = [w for w in (norm(t) for t in transcript.split()) if w]

    status = ["unread"] * len(disp)                       # per display token
    miscues, inserted = [], []
    sm = SequenceMatcher(None, ref_n, hyp, autojunk=False)
    ops = sm.get_opcodes()
    # last passage word the reader reached (end of the last block containing a match)
    reached = 0
    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal" or (tag == "replace"):
            reached = i2
    for tag, i1, i2, j1, j2 in ops:
        if i1 >= reached and tag != "insert":
            continue
        if tag == "equal":
            for i in range(i1, i2):
                status[keep[i]] = "correct"
        elif tag == "replace":
            said = hyp[j1:j2]
            for k, i in enumerate(range(i1, min(i2, reached))):
                s = said[k] if k < len(said) else None
                if s is not None and _close(ref_n[i], s):
                    status[keep[i]] = "correct"
                elif s is None:
                    status[keep[i]] = "skipped"
                    miscues.append({"index": keep[i], "expected": disp[keep[i]], "said": None, "type": "skipped"})
                else:
                    status[keep[i]] = "misread"
                    miscues.append({"index": keep[i], "expected": disp[keep[i]], "said": s, "type": "misread"})
            if len(said) > i2 - i1:
                inserted += said[i2 - i1:]
        elif tag == "delete":
            for i in range(i1, min(i2, reached)):
                status[keep[i]] = "skipped"
                miscues.append({"index": keep[i], "expected": disp[keep[i]], "said": None, "type": "skipped"})
        elif tag == "insert":
            inserted += hyp[j1:j2]

    attempted = sum(1 for s in status if s != "unread" and s is not None) or 0
    correct = sum(1 for s in status if s == "correct")
    minutes = max(seconds, 1) / 60
    return {
        "status": status,
        "tokens": disp,
        "words_in_passage": len(ref_n),
        "words_attempted": attempted,
        "words_correct": correct,
        "accuracy": round(correct / attempted, 3) if attempted else 0.0,
        "wcpm": round(correct / minutes),
        "seconds": round(seconds, 1),
        "finished": reached >= len(ref_n) - 2,
        "miscues": miscues,
        "inserted_words": inserted[:20],
        "practice_words": sorted({w for w in (m["expected"].strip(".,;:!?\"'()—–-“”‘’").lower() for m in miscues) if len(w) > 3})[:8],
    }
