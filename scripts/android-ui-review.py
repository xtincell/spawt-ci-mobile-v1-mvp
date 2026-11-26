"""Exercise the three real screens against loopback data, then retain their Android pixels."""
import json
import os
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).with_name("pilot-android-qa")))
from native import adb, BRUNCH, FIXTURES, find, login, now, PACKAGE, tap, tree

out = pathlib.Path("ui-review")
out.mkdir(exist_ok=True)
results = {"source": os.environ["GITHUB_SHA"], "native": "debug x86_64 build 45, Android 15",
           "api": "isolated loopback fixture", "screens": {}}
review = json.loads(pathlib.Path("app/src/data/le-cha-review.json").read_text())
def open_url(url):
    adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d",url,"-p",PACKAGE)
def shot(name):
    time.sleep(.7)
    (out/(name+".png")).write_bytes(subprocess.check_output(["adb","exec-out","screencap","-p"]))
def stage(name, run):
    try:
        run()
        results["screens"][name] = {"pass":True,"at":now()}
    except Exception as error:
        results["screens"][name] = {"pass":False,"error":str(error),"at":now()}
        print(name, error, flush=True)
def le_cha():
    open_url("https://spawt.online/ouvrir/avis/le-cha-alexandre")
    find("le-cha-review-title",95); find("le-cha-review-photo"); find("le-cha-review-comment")
    observed = tree()
    for label in ("Cuisine 4,5/5", "Cadre 4/5", "Service 3/5"):
        assert any(label in n.get("content-desc","") for n in observed.iter("node")), label
    shot("le-cha")
    adb("shell","am","force-stop",PACKAGE)
def authenticate():
    adb("shell","am","start","-W","-n",PACKAGE+"/.MainActivity")
    login(FIXTURES[3]); find("Accueil")
def saved():
    open_url("spawt://saved");find("saved-empty");shot("mes-envies-vide")
    open_url("spawt://place/"+BRUNCH);find("IN’ Concept Store")
    tap("Sauvegarde pour plus tard");find("Sauvegardé")
    open_url("spawt://saved");find("saved-place-"+BRUNCH);shot("mes-envies-adresse")
def carte():
    open_url("spawt://carte");find("carte-inventory-count");find("carte-mapview");time.sleep(8)
    for label in ("carte-filter-all","carte-filter-unexplored","carte-filter-mine"): find(label,5)
    shot("carte")
    tap("carte-view-toggle");time.sleep(1);shot("carte-liste");tap("carte-view-toggle");find("carte-mapview")
stage("Le Cha",le_cha)
stage("Identification interne",authenticate)
if results["screens"]["Identification interne"]["pass"]:
    stage("Mes envies",saved);stage("Carte",carte)
(out/"recu.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
if not all(r["pass"] for r in results["screens"].values()):sys.exit(1)
