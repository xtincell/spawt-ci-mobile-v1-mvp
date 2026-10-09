#!/usr/bin/env python3
"""Recette ADB sur deux comptes synthétiques alpha ; captures, XML et assertions.
Le SDK doit être prêt et l'APK installée. Aucune clé serveur ni session n'est journalisée.
"""
import os, re, json, time, pathlib, subprocess, xml.etree.ElementTree as ET, urllib.request
OUT=pathlib.Path('android-proof'); OUT.mkdir(exist_ok=True)
PACKAGE='com.upgraders.spawt'; PLACE='a1000000-0000-4000-8000-000000000004'
PHONE=os.environ['SPAWT_QA_PHONE']; MODE=os.environ.get('SPAWT_QA_MODE','observe')
RESULTS=[]

def adb(*args, binary=False):
    r=subprocess.run(['adb','-s',os.environ.get('SPAWT_QA_SERIAL','emulator-5554'),*map(str,args)],capture_output=True,check=True,timeout=40)
    return r.stdout if binary else r.stdout.decode(errors='replace')

def nodes():
    adb('shell','uiautomator','dump','/sdcard/window.xml')
    raw=adb('exec-out','cat','/sdcard/window.xml')
    return ET.fromstring(raw),raw

def label(n): return n.get('text','')+' '+n.get('content-desc','')+' '+n.get('resource-id','')

def find(value, timeout=25, exact=False):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        tree,_=nodes()
        for n in tree.iter('node'):
            if (any(n.get(k)==value for k in ['text','content-desc','resource-id']) if exact else value in label(n)):
                if n.get('bounds') not in (None,'[0,0][0,0]'): return n
        time.sleep(.4)
    raise AssertionError('Native control not found: '+value)

def tap_node(n):
    b=list(map(int,re.findall(r'\d+',n.get('bounds','')))); assert len(b)==4
    adb('shell','input','tap',(b[0]+b[2])//2,(b[1]+b[3])//2)

def tap(value, timeout=25, exact=False): tap_node(find(value,timeout,exact))
def deep(path): adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','spawt://'+path,PACKAGE); time.sleep(1.2)
def snap(name):
    tree,raw=nodes(); (OUT/(name+'.xml')).write_text(raw)
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))
    texts=[n.get('text') or n.get('content-desc') for n in tree.iter('node') if n.get('text') or n.get('content-desc')]
    print(name+': '+ ' | '.join(texts)[:1200],flush=True)
    return tree

def check(name, ok):
    RESULTS.append({'check':name,'passed':bool(ok)}); assert ok,name

def geometry(width,scale):
    adb('shell','wm','size',f'{width*3}x2400'); adb('shell','wm','density','480')
    adb('shell','settings','put','system','font_scale',scale); time.sleep(1)

def login(phone):
    deep('phone'); tap('phone-input'); adb('shell','input','text',phone)
    adb('shell','input','keyevent','4'); tap('phone-send')
    for i,digit in enumerate('123456'):
        tap(f'otp-cell-{i}'); adb('shell','input','text',digit)
    find('Feed',timeout=40,exact=True)
    time.sleep(1)

def home():
    deep(''); find('Feed',exact=True)

def back(): adb('shell','input','keyevent','4'); time.sleep(.5)

def scroll_find(value, attempts=6):
    for _ in range(attempts):
        try: return find(value,timeout=2)
        except AssertionError: scroll()
    raise AssertionError('Native control absent after scroll: '+value)

def scroll_tap(value): tap_node(scroll_find(value))

def scroll(): adb('shell','input','swipe','550','1850','550','650','350'); time.sleep(.6)

try:
    geometry(393,1)
    # Ouverture à vitesse normale, puis animations système neutralisées pour la matrice.
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,1)
    recording=subprocess.Popen(['adb','-s','emulator-5554','shell','screenrecord','--time-limit','8','--bit-rate','1500000','/sdcard/opening.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    adb('shell','monkey','-p',PACKAGE,'-c','android.intent.category.LAUNCHER','1')
    recording.wait(timeout=15); adb('pull','/sdcard/opening.mp4',str(OUT/'opening.mp4'))
    snap('cold-opening')
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,0)
    login(PHONE)
    snap('signed-in')
    if MODE=='observe':
        deep('place/'+PLACE); find('La Grande République'); snap('place-initial')
    else:
        for width in [320,360,393,430]:
            for scale in [1,1.3,1.5]:
                geometry(width,scale); home(); snap(f'{width}-{scale}-feed')
                tap('Palais',exact=True); find('Recette Android'); snap(f'{width}-{scale}-profile')
                deep('search'); find('Chercher'); snap(f'{width}-{scale}-search')
                deep('saved'); time.sleep(1); snap(f'{width}-{scale}-saved')
                deep('place/'+PLACE); find('La Grande République'); snap(f'{width}-{scale}-place')
                tap('place-start-review'); find('review-note_cuisine-5')
                tap('review-note_cuisine-5'); tap('review-note_cadre-4'); tap('review-note_service-4')
                tree=snap(f'{width}-{scale}-review')
                check(f'{width}-{scale}: 4,3 visible',any('4,3' in label(n) for n in tree.iter('node')))
                button=find('review-submit'); b=list(map(int,re.findall(r'\d+',button.get('bounds',''))))
                check(f'{width}-{scale}: publish button within screen',b[1]>0 and b[3]<=2400)
                back()
        geometry(393,1); deep('place/'+PLACE); tap('place-start-review')
        scroll(); tap('review-text'); adb('shell','input','text','Recette%snative%sSPAWT%s1.1.1')
        time.sleep(.7); tree=snap('keyboard-review'); button=find('review-submit')
        b=list(map(int,re.findall(r'\d+',button.get('bounds','')))); check('keyboard publish remains above IME',b[3]<2100)
        back(); tap('review-submit'); find('Avis publié',timeout=40); snap('published-receipt'); tap('OK',exact=True)
        # Redémarrage réel du processus, sans effacer le stockage.
        adb('shell','am','force-stop',PACKAGE); deep('place/'+PLACE)
        scroll_tap('Avis'); scroll_find('Recette native SPAWT 1.1.1'); snap('published-after-restart')
        check('review visible after process restart',True)
finally:
    (OUT/'assertions.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2))
    try: snap('last-state')
    except Exception: pass
