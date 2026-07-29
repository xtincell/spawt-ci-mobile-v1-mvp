#!/usr/bin/env python3
"""Répare les métriques verticales `hhea` d'une police TrueType/OpenType.

Contexte complet : `spawt-admin/FONTS.md`.

En deux lignes : la conversion OTF -> TTF du Gotham SPAWT a laissé la table
`hhea` entièrement à zéro. Blink (Chrome, Edge, Electron) et Android lisent
`hhea` avant `OS/2` sur une TrueType, donc `line-height: normal` y valait 0 :
le texte se peignait sans occuper la moindre hauteur, et la page se superposait
à elle-même.

On réécrit `hhea` depuis les métriques `usWinAscent`/`usWinDescent` de la table
`OS/2` du fichier lui-même. Elles bornent l'encre par construction : aucun
accent ne peut être rogné, ce qui compte pour un produit en français. Sur le
Gotham-Bold, ces valeurs redonnent exactement le `hhea` du .otf d'origine du
fondeur — la déduction reproduit l'intention de l'auteur de la police.

    python3 fix-font-metrics.py --verifier polices/*.ttf   # audit, n'écrit rien
    python3 fix-font-metrics.py polices/*.ttf              # répare sur place

Sortie : un code de retour non nul si au moins un fichier est (ou reste) atteint,
ce qui permet de brancher `--verifier` sur un pre-commit ou la CI.
"""

import struct
import sys

# Constante de checkSumAdjustment définie par la spécification OpenType.
MAGIC = 0xB1B0AFBA


def _tables(buf):
    """Retourne {tag: (offset, longueur, offset_de_l_entree)}."""
    count = struct.unpack(">H", buf[4:6])[0]
    out = {}
    for i in range(count):
        rec = 12 + 16 * i
        tag = bytes(buf[rec:rec + 4]).decode("latin1")
        offset, length = struct.unpack(">II", buf[rec + 8:rec + 16])
        out[tag] = (offset, length, rec)
    return out


def _checksum(buf, offset, length):
    """Somme des uint32 big-endian de la table, complétée à un multiple de 4."""
    data = bytes(buf[offset:offset + length]) + b"\0" * (-length % 4)
    return sum(struct.unpack(">%dI" % (len(data) // 4), data)) & 0xFFFFFFFF


def lire(path):
    """Métriques courantes, ou None si le fichier n'est pas une police sfnt."""
    buf = open(path, "rb").read()
    if buf[:4] not in (b"\x00\x01\x00\x00", b"OTTO", b"true"):
        return None
    t = _tables(buf)
    if not {"hhea", "OS/2", "head"} <= set(t):
        return None
    ho = t["hhea"][0]
    oo = t["OS/2"][0]
    return {
        "hhea": struct.unpack(">hhh", buf[ho + 4:ho + 10]),
        "win": struct.unpack(">HH", buf[oo + 74:oo + 78]),
        "upem": struct.unpack(">H", buf[t["head"][0] + 18:t["head"][0] + 20])[0],
    }


def reparer(path):
    """Réécrit hhea sur place. Retourne (atteint_avant, message)."""
    etat = lire(path)
    if etat is None:
        return False, "ignoré (pas une police sfnt exploitable)"

    asc, desc, gap = etat["hhea"]
    if (asc, desc) != (0, 0):
        return False, "sain — hhea = %d / %d / %d" % (asc, desc, gap)

    win_asc, win_desc = etat["win"]
    if (win_asc, win_desc) == (0, 0):
        return True, "IRRÉPARABLE : OS/2 est nul lui aussi, repartir du .otf"

    buf = bytearray(open(path, "rb").read())
    t = _tables(buf)
    ho, hlen, hrec = t["hhea"]
    struct.pack_into(">hhh", buf, ho + 4, win_asc, -win_desc, 0)

    # Somme de contrôle de la table hhea, dans le répertoire de tables.
    struct.pack_into(">I", buf, hrec + 4, _checksum(buf, ho, hlen))

    # head.checkSumAdjustment : mis à zéro, puis dérivé du fichier entier.
    head = t["head"][0]
    struct.pack_into(">I", buf, head + 8, 0)
    struct.pack_into(">I", buf, head + 8, (MAGIC - _checksum(buf, 0, len(buf))) & 0xFFFFFFFF)

    open(path, "wb").write(buf)
    interligne = (win_asc + win_desc) / etat["upem"]
    return True, "réparé — hhea = 0/0/0 → %d / %d / 0 (interligne %.3f em)" % (
        win_asc, -win_desc, interligne)


def main(argv):
    verifier = "--verifier" in argv
    chemins = [a for a in argv if not a.startswith("--")]
    if not chemins:
        print(__doc__)
        return 2

    atteints = 0
    for p in chemins:
        try:
            if verifier:
                etat = lire(p)
                if etat is None:
                    msg, ko = "ignoré (pas une police sfnt exploitable)", False
                else:
                    ko = etat["hhea"][0] == 0 and etat["hhea"][1] == 0
                    msg = ("ATTEINT — hhea = 0/0/0" if ko
                           else "sain — hhea = %d / %d / %d" % etat["hhea"])
            else:
                ko, msg = reparer(p)
            atteints += bool(ko)
            print("%-40s %s" % (p.split("/")[-1], msg))
        except Exception as exc:
            atteints += 1
            print("%-40s ERREUR : %s" % (p.split("/")[-1], exc))

    if verifier and atteints:
        print("\n%d police(s) atteinte(s). Relancer sans --verifier pour réparer." % atteints)
    return 1 if (verifier and atteints) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
