#!/usr/bin/env python3
"""Recette ADB sur deux comptes synthétiques alpha ; captures, XML et assertions.
Le SDK doit être prêt et l'APK installée. Aucune clé serveur ni session n'est journalisée.
"""
import os, re, json, time, pathlib, subprocess, xml.etree.ElementTree as ET, urllib.request
OUT=pathlib.Path('android-proof'); OUT.mkdir(exist_ok=True)
PACKAGE='com.upgraders.spawt'; PLACE='a1000000-0000-4000-8000-000000000004'
PHONE=os.environ['SPAWT_QA_PHONE']; MODE=os.environ.get('SPAWT_QA_MODE','observe')
OWNER={'+2250000000193':'6445b010-5e4d-4322-9d4d-ea5a31fd922e','+2250000000194':'dca6b8a2-0c57-4adb-8858-93736370d3ed'}[PHONE]
RESULTS=[]
RUN=os.environ.get('GITHUB_RUN_ID',str(int(time.time())))
MARKER='Recette native SPAWT 1.1.1 '+RUN

def adb(*args, binary=False):
    r=subprocess.run(['adb','-s',os.environ.get('SPAWT_QA_SERIAL','emulator-5554'),*map(str,args)],capture_output=True,check=True,timeout=40)
    return r.stdout if binary else r.stdout.decode(errors='replace')

def nodes():
    raw=''
    for _ in range(3):
        adb('shell','rm','-f','/sdcard/window.xml')
        dump=adb('shell','uiautomator','dump','/sdcard/window.xml')
        raw=adb('exec-out','cat','/sdcard/window.xml')
        if raw.lstrip().startswith('<?xml'):
            return ET.fromstring(raw),raw
        (OUT/'ui-dump-error.txt').write_text(dump+'\n'+raw)
        time.sleep(.6)
    raise RuntimeError('Android UI hierarchy unavailable: '+raw[:250])

def label(n): return n.get('text','')+' '+n.get('content-desc','')+' '+n.get('resource-id','')

def find(value, timeout=25, exact=False):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        tree,_=nodes()
        for n in tree.iter('node'):
            if (any(n.get(k,'').casefold()==value.casefold() for k in ['text','content-desc','resource-id']) if exact else value.casefold() in label(n).casefold()):
                b=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
                if len(b)==4 and b[2]>b[0] and b[3]>b[1]: return n
        time.sleep(.4)
    raise AssertionError('Native control not found: '+value)

def tap_node(n):
    b=list(map(int,re.findall(r'\d+',n.get('bounds','')))); assert len(b)==4
    adb('shell','input','tap',(b[0]+b[2])//2,(b[1]+b[3])//2)

def tap(value, timeout=25, exact=False): tap_node(find(value,timeout,exact))
def deep(path):
    result=adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','spawt://'+path,PACKAGE)
    with (OUT/'navigation.txt').open('a') as log: log.write(path+'\n'+result+'\n')
    time.sleep(1.2)

def restart():
    # Même geste qu'une réouverture depuis le launcher : laisser la session
    # se restaurer avant de naviguer. Un intent froid peut restaurer la tâche
    # Android sur son dernier onglet ; ce n'est pas le parcours testé ici.
    adb('shell','am','force-stop',PACKAGE)
    adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
    find('Feed',timeout=40,exact=True)
def snap(name):
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))
    tree,raw=nodes(); (OUT/(name+'.xml')).write_text(raw)
    texts=[n.get('text') or n.get('content-desc') for n in tree.iter('node') if n.get('text') or n.get('content-desc')]
    print(name+': '+ ' | '.join(texts)[:1200],flush=True)
    if MODE in ('full','matrix','photos'):
        check(name+': labels translated',not any('a11y.stars' in text or 'review.section_photos' in text.casefold() for text in texts))
    return tree

def bounds(n): return list(map(int,re.findall(r'\d+',n.get('bounds',''))))

def public_reviews(owner=OWNER):
    cfg=json.loads(pathlib.Path('app/eas.json').read_text())['build']['preview']['env']
    url=cfg['EXPO_PUBLIC_SUPABASE_URL']+'/rest/v1/public_reviews?select=id,texte_avis,note_cuisine,note_cadre,note_service,note_globale,photos,avatar_url&spawter_id=eq.'+owner
    req=urllib.request.Request(url,headers={'apikey':cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY'],'User-Agent':'SPAWT-Android-QA'})
    with urllib.request.urlopen(req,timeout=25) as response: return json.load(response)

def check(name, ok):
    RESULTS.append({'check':name,'passed':bool(ok)})
    print('ASSERT '+name+': '+('PASS' if ok else 'FAIL'),flush=True)
    assert ok,name

def geometry(width,scale):
    adb('shell','wm','size',f'{width*3}x2400'); adb('shell','wm','density','480')
    adb('shell','settings','put','system','font_scale',scale); time.sleep(1)

def login(phone):
    deep('phone'); tap('phone-input'); adb('shell','input','text',phone.removeprefix('+225'))
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
        try:
            candidate=find(value,timeout=2)
            tree,_=nodes()
            # UIAutomator peut annoncer un enfant du ScrollView derrière le
            # pied fixe. Ne pas taper sa position tant qu'elle est recouverte.
            footers=[bounds(n)[1] for n in tree.iter('node') if n.get('resource-id') in ('review-submit','place-start-review')]
            limit=min(footers) if footers else 2320
            if bounds(candidate)[3] <= limit-8: return candidate
        except AssertionError: pass
        scroll()
    raise AssertionError('Native control absent after scroll: '+value)

def scroll_tap(value): tap_node(scroll_find(value))

def scroll(): adb('shell','input','swipe','550','1500','550','550','350'); time.sleep(.6)

def rate():
    for key,n in [('cuisine',5),('cadre',4),('service',4)]: scroll_tap(f'review-note_{key}-{n}')

def write_review(text):
    scroll_tap('review-text'); adb('shell','input','text',text.replace(' ','%s')); back()

def twice(value):
    b=bounds(find(value)); x=(b[0]+b[2])//2; y=(b[1]+b[3])//2
    adb('shell',f'input tap {x} {y}; input tap {x} {y}')

def pick_test_photo(name):
    snap(name+'-picker')
    tree,_=nodes()
    candidates=[n for n in tree.iter('node') if
        'icon_thumbnail' in n.get('resource-id','') or
        'spawt-qa.png' in label(n) or
        n.get('content-desc','').lower().startswith('photo taken')]
    if not candidates:
        raise AssertionError('Test image not exposed by Android picker; inspect '+name+'-picker.xml')
    tap_node(candidates[0]); time.sleep(.7)

def wait_public(text):
    end=time.monotonic()+50
    while time.monotonic()<end:
        rows=[r for r in public_reviews() if r['texte_avis']==text]
        if rows: return rows
        time.sleep(1)
    raise AssertionError('Native publication not received by server: '+text)

def photo_and_network_cases():
    photo_text='Recette photo SPAWT 1.1.1 '+RUN
    queued_text='Recette reseau SPAWT 1.1.1 '+RUN
    adb('shell','mkdir','-p','/sdcard/Pictures')
    adb('push','app/assets/icon.png','/sdcard/Pictures/spawt-qa.png')
    adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Pictures/spawt-qa.png')
    home(); tap('Palais',exact=True); find('Recette Android'); snap('moka-default-profile')
    tap('Changer ma photo de profil'); tap('Prendre une photo',exact=True)
    tap('permission_deny_button'); find('Autorisation requise'); snap('camera-denied'); tap('OK',exact=True)
    check('camera refusal remains actionable',True)
    deep('place/'+PLACE); twice('place-start-review'); rate(); write_review(photo_text)
    scroll_find('review-photo-add'); snap('before-photo-picker'); scroll_tap('review-photo-add'); pick_test_photo('review')
    find('review-photo-0'); snap('selected-photo-preview')
    adb('shell','cmd','connectivity','airplane-mode','enable')
    tap('review-submit')
    find('Avis non envoyé',timeout=15); snap('failed-upload-receipt'); tap('OK',exact=True)
    scroll_find('review-photo-0'); snap('failed-upload-keeps-photo')
    check('failed upload does not publish',not any(r['texte_avis']==photo_text for r in public_reviews()))
    adb('shell','cmd','connectivity','airplane-mode','disable')
    time.sleep(2); restart()
    deep('place/'+PLACE); tap('place-start-review'); scroll_find('review-photo-0'); snap('photo-draft-after-restart')
    check('photo draft survives process restart',True)
    twice('review-submit'); find('Avis publié',timeout=50); snap('photo-published'); tap('OK',exact=True)
    rows=wait_public(photo_text)
    check('single photo review with 4.3',len(rows)==1 and rows[0]['note_globale']==4.3 and len(rows[0]['photos'])==1)
    # Lien signé demandé avec les droits publics, jamais une clé serveur.
    cfg=json.loads(pathlib.Path('app/eas.json').read_text())['build']['preview']['env']; base=cfg['EXPO_PUBLIC_SUPABASE_URL']
    path=rows[0]['photos'][0]
    req=urllib.request.Request(base+'/storage/v1/object/sign/place-photos/'+path,data=json.dumps({'expiresIn':60}).encode(),headers={'apikey':cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY'],'Authorization':'Bearer '+cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY'],'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=25) as response: signed=json.load(response)['signedURL']
    with urllib.request.urlopen(base+'/storage/v1'+signed,timeout=25) as response: photo=response.read()
    check('private review photo resolves through signed URL',photo[:2]==b'\xff\xd8' and len(photo)>1000)
    deep('place/'+PLACE); tap('place-start-review'); rate(); write_review(queued_text)
    adb('shell','cmd','connectivity','airplane-mode','enable')
    twice('review-submit'); find('Avis en attente d’envoi',timeout=50)
    check('queued receipt is truthful before reconnect',not any(r['texte_avis']==queued_text for r in public_reviews()))
    # Retour avant le backoff de 5 s : la relance doit fonctionner sans autre geste.
    adb('shell','cmd','connectivity','airplane-mode','disable')
    snap('queued-receipt'); tap('OK',exact=True)
    rows=wait_public(queued_text); check('queued review automatically delivered once',len(rows)==1 and rows[0]['note_globale']==4.3)
    home(); tap('Palais',exact=True); tap('Changer ma photo de profil'); tap('Choisir dans la galerie',exact=True)
    pick_test_photo('avatar'); snap('avatar-crop')
    tap('crop_image_menu_crop'); time.sleep(3); snap('personal-photo-profile')
    find('spawtercard-avatar-photo')
    check('personal avatar persisted',any(r['avatar_url'] for r in wait_public(photo_text)))
    # Autre compte natif, avec stockage local entièrement neuf.
    adb('shell','pm','clear',PACKAGE); login('+2250000000194')
    home(); tap('Palais',exact=True); find('Recette Android 1.1.1 B'); snap('second-account-moka')
    deep('place/'+PLACE); scroll_tap('Avis'); scroll_find('Alexandre',attempts=10); tree=snap('founder-public-author')
    check('founder publicly displays Alexandre',any('Alexandre' in label(n) for n in tree.iter('node')) and not any('Mission 1' in label(n) for n in tree.iter('node')))
    scroll_find(photo_text); scroll_find('Photo jointe à cet avis'); snap('photo-review-from-second-account')
    check('published review readable from another native account',True)
    # Vérifier aussi l'ouverture animée avec une session restaurée. La matrice
    # utilise ensuite la réduction système des animations pour ses captures.
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,1)
    restart(); snap('normal-opening-signed-in')
    check('animated opening restores signed-in account',True)
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,0)

try:
    geometry(393,1)
    # Le launcher Google peut rester occupé après le premier redimensionnement.
    # L'app est lancée directement ; un éventuel ANR SPAWT reste un échec.
    adb('shell','am','force-stop','com.google.android.apps.nexuslauncher')
    # Ouverture à vitesse normale, puis animations système neutralisées pour la matrice.
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,1)
    recording=subprocess.Popen(['adb','-s','emulator-5554','shell','screenrecord','--time-limit','18','--bit-rate','1500000','/sdcard/opening.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
    recording.wait(timeout=25); adb('pull','/sdcard/opening.mp4',str(OUT/'opening.mp4'))
    tree,_=nodes()
    if any("Pixel Launcher isn't responding" in label(n) for n in tree.iter('node')):
        tap('Close app',exact=True)
    tree=snap('cold-opening')
    check('cold animated launch keeps SPAWT in foreground',any(n.get('package')==PACKAGE for n in tree.iter('node')))
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,0)
    login(PHONE)
    snap('signed-in')
    if MODE=='observe':
        deep('place/'+PLACE); find('La Grande République'); snap('place-initial')
    elif MODE=='photos':
        photo_and_network_cases()
    else:
        deep('place/'+PLACE)
        try: tap('Sauvegarde pour plus tard',timeout=3)
        except AssertionError: pass  # Le favori peut déjà venir d'une recette précédente.
        for width in [320,360,393,430]:
            for scale in [1,1.3,1.5]:
                geometry(width,scale); home(); snap(f'{width}-{scale}-feed')
                scroll(); snap(f'{width}-{scale}-feed-cards')
                tap('Palais',exact=True); find('Recette Android'); snap(f'{width}-{scale}-profile')
                card=bounds(find('spawtercard',exact=True))
                check(f'{width}-{scale}: profile card stays inside horizontal padding',card[0]>=48 and card[2]<=width*3-48)
                deep('search'); find('Cherche un spawt')
                tree,_=nodes()
                field=next(n for n in tree.iter('node') if n.get('class')=='android.widget.EditText')
                tap_node(field); adb('shell','input','text','Grande'); back()
                find('La Grande République'); snap(f'{width}-{scale}-search')
                deep('saved'); find('La Grande République'); snap(f'{width}-{scale}-saved')
                deep('place/'+PLACE); find('La Grande République'); snap(f'{width}-{scale}-place')
                tap('place-start-review'); find('review-note_cuisine-5')
                snap(f'{width}-{scale}-review-title')
                scroll_tap('review-note_cuisine-5'); scroll_tap('review-note_cadre-4'); scroll_tap('review-note_service-4')
                scroll_find('review-global-rating')
                tree=snap(f'{width}-{scale}-review')
                check(f'{width}-{scale}: 4,3 visible',any('4,3' in label(n) for n in tree.iter('node')))
                button=find('review-submit'); b=bounds(button)
                check(f'{width}-{scale}: publish button within screen',b[1]>0 and b[3]<=2400)
                scroll_tap('review-text'); time.sleep(.7)
                snap(f'{width}-{scale}-keyboard')
                (OUT/f'{width}-{scale}-keyboard-window.txt').write_text(adb('shell','dumpsys','window','windows'))
                check(f'{width}-{scale}: keyboard footer remains on screen',bounds(find('review-submit'))[3]<2100)
                back()
                back()
        geometry(393,1); deep('place/'+PLACE); tap('place-start-review')
        scroll_tap('review-text'); adb('shell','input','text',MARKER.replace(' ','%s'))
        time.sleep(.7); tree=snap('keyboard-review'); button=find('review-submit')
        (OUT/'keyboard-input-method.txt').write_text(adb('shell','dumpsys','input_method'))
        (OUT/'keyboard-window.txt').write_text(adb('shell','dumpsys','window','windows'))
        b=list(map(int,re.findall(r'\d+',button.get('bounds','')))); check('keyboard publish remains above IME',b[3]<2100)
        back(); tap('review-submit'); find('Avis publié',timeout=40); snap('published-receipt'); tap('OK',exact=True)
        # Redémarrage réel du processus, sans effacer le stockage.
        restart(); deep('place/'+PLACE)
        scroll_tap('Avis')
        # La fiche montre les cinq avis les mieux notés. Un nouvel avis à 4,3
        # peut être au-delà de ce résumé : suivre le vrai parcours de lecture.
        try:
            scroll_tap('Voir tous les avis')
        except AssertionError:
            deep('place/'+PLACE); scroll_tap('Avis')
        scroll_find(MARKER); snap('published-after-restart')
        check('review visible after process restart',True)
        rows=[r for r in public_reviews() if r['texte_avis']==MARKER]
        check('one native review persisted with 5/4/4 and 4.3',len(rows)==1 and rows[0]['note_cuisine']==5 and rows[0]['note_cadre']==4 and rows[0]['note_service']==4 and rows[0]['note_globale']==4.3)
        if MODE=='full': photo_and_network_cases()
finally:
    try: adb('shell','cmd','connectivity','airplane-mode','disable')
    except Exception: pass
    (OUT/'assertions.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2))
    try: snap('last-state')
    except Exception: pass
