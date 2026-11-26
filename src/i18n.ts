// Every word on the page, per language. The language is the first one the
// visitor's browser asks for that is written here, or `?lang=` when the
// address says so. A caption breaks into one scrap of paper per line.

export const en = {
  title: 'the tale of fleet',
  tagline: 'where your laptops, desktops and home servers form one giant family.',

  drift: "if you have more than one computer,\nit's hard to keep them in sync.",
  rows: ['coding agents', 'their instructions', 'their skills', 'ssh keys'],
  ages: ['today', 'august', 'none'],

  mesh: 'fleet syncs your setup to every machine,\nplus they can all freely connect to and access each other.',

  agents: "it's okay to use many different harnesses.\nfleet keeps them synced and up-⁠to-⁠date daily.",
  rules: ['always pull before you start', 'ask before you cut a release'],

  tools: 'you connect your google, microsoft, icloud accounts once,\nthen all agents across the fleet now have access.',

  cloud: 'you can self-host your own cloud storage\nand manage your photo library too.',
  search: 'camera receipt',

  join: 'and so much more.',
  door: 'join the fleet',
  machines: { laptop: 'laptop', desktop: 'desktop', mini: 'mini', nas: 'nas' },
  yours: 'yours',
};

type Words = typeof en;

/** a catalog with each `|` turned into a place a line may break */
const phrased = (words: Words): Words => JSON.parse(JSON.stringify(words).split('|').join('\u200b'));

export const ko: Words = {
  title: '플릿 이야기',
  tagline: '노트북, 데스크톱, 홈서버가 하나의 큰 가족이 되는 곳.',
  drift: '컴퓨터가 두 대 이상이면,\n똑같이 설정을 맞춰 두기가 귀찮아져요.',
  rows: ['코딩 에이전트', '지시 사항', '스킬', 'ssh 키'],
  ages: ['오늘', '8월', '없음'],
  mesh: '그래서 플릿은 내 설정을 모든 컴퓨터에 동기화하고,\n컴퓨터끼리 서로 자유롭게 드나들 수 있게 해 줘요.',
  agents: '하네스를 여러 개 써도 괜찮아요.\n플릿이 매일 동기화하고 업데이트해 주거든요.',
  rules: ['시작하기 전에 항상 pull하기', '릴리스는 물어보고 내기'],
  tools: '구글, 마이크로소프트, 아이클라우드 계정을 한 번만 연결하면,\n플릿의 모든 에이전트가 바로 쓸 수 있게 돼요.',
  cloud: '나만의 클라우드 드라이브를 직접 호스팅하고\n사진 보관함도 관리할 수 있어요.',
  search: '카메라 영수증',
  join: '수많은 기능들이 당신을 기다리고 있답니다.',
  door: '플릿단에 합류하기',
  machines: { laptop: '노트북', desktop: '데스크톱', mini: '미니', nas: 'NAS' },
  yours: '당신의 컴퓨터',
};

/** the phone call. Ringing a phone only reaches Korean numbers, so this
    scene is shown to Korean readers alone and is written in Korean only. */
export const call = {
  title: '마지막으로,\n이제 에이전트가 나에게 전화를 걸 수도 있어요.',
  yourAgent: '내 에이전트',
  agent: '에이전트',
  you: '나',
  asks: ['테스트 통과했어요. 머지할까요,', '아니면 기다릴까요?'],
  answer: '진행시켜 줘.',
};

const ar: Words = {
  title: 'حكاية fleet',
  tagline: 'حيث تصير حواسيبك المحمولة والمكتبية وخوادمك المنزلية عائلة واحدة كبيرة.',
  drift: 'إذا كان لديك أكثر من حاسوب،\nفمن الصعب إبقاؤها متطابقة.',
  rows: ['وكلاء البرمجة', 'تعليماتهم', 'مهاراتهم', 'مفاتيح ssh'],
  ages: ['اليوم', 'أغسطس', 'لا شيء'],
  mesh: 'ينقل fleet إعداداتك إلى كل جهاز،\nوتستطيع الأجهزة كلها الاتصال ببعضها والدخول إليها بحرية.',
  agents: 'لا بأس باستخدام وكلاء برمجة مختلفين.\nيبقيهم fleet متزامنين ومحدَّثين كل يوم.',
  rules: ['نفّذ pull دائمًا قبل البدء', 'اسأل قبل نشر إصدار'],
  tools: 'تربط حساباتك في google و microsoft و icloud مرة واحدة،\nفيصل إليها كل الوكلاء في fleet.',
  cloud: 'يمكنك استضافة تخزينك السحابي بنفسك\nوإدارة مكتبة صورك أيضًا.',
  search: 'إيصال الكاميرا',
  join: 'وأكثر من ذلك بكثير.',
  door: 'انضم إلى fleet',
  machines: { laptop: 'محمول', desktop: 'مكتبي', mini: 'ميني', nas: 'nas' },
  yours: 'حاسوبك',
};

const bg: Words = {
  title: 'приказка за fleet',
  tagline: 'където твоите лаптопи, настолни компютри и домашни сървъри стават едно голямо семейство.',
  drift: 'ако имаш повече от един компютър,\nтрудно е да ги държиш еднакви.',
  rows: ['кодиращи агенти', 'инструкциите им', 'уменията им', 'ssh ключове'],
  ages: ['днес', 'август', 'няма'],
  mesh: 'fleet пренася настройките ти на всяка машина,\nа те могат свободно да се свързват една с друга.',
  agents: 'спокойно ползвай различни кодиращи агенти.\nfleet ги синхронизира и обновява всеки ден.',
  rules: ['винаги pull, преди да започнеш', 'питай, преди да пуснеш версия'],
  tools: 'свързваш акаунтите си в google, microsoft и icloud веднъж,\nи всички агенти във fleet вече имат достъп.',
  cloud: 'можеш сам да хостваш своето облачно хранилище\nи да подреждаш снимките си.',
  search: 'касова бележка',
  join: 'и още много.',
  door: 'присъедини се към fleet',
  machines: { laptop: 'лаптоп', desktop: 'настолен', mini: 'мини', nas: 'nas' },
  yours: 'твоят',
};

const cs: Words = {
  title: 'příběh fleetu',
  tagline: 'kde tvoje notebooky, stolní počítače a domácí servery tvoří jednu velkou rodinu.',
  drift: 'když máš víc než jeden počítač,\nje těžké udržet je stejné.',
  rows: ['kódovací agenti', 'jejich instrukce', 'jejich dovednosti', 'ssh klíče'],
  ages: ['dnes', 'srpen', 'nic'],
  mesh: 'fleet přenese tvoje nastavení na každý stroj,\na všechny se navíc můžou volně připojit jeden k druhému.',
  agents: 'klidně používej víc různých kódovacích agentů.\nfleet je každý den synchronizuje a aktualizuje.',
  rules: ['před začátkem vždy udělej pull', 'před vydáním verze se zeptej'],
  tools: 'účty google, microsoft a icloud připojíš jednou,\na přístup mají hned všichni agenti ve fleetu.',
  cloud: 'můžeš si sám hostovat vlastní cloudové úložiště\na spravovat i knihovnu fotek.',
  search: 'účtenka foťák',
  join: 'a mnohem víc.',
  door: 'přidej se k fleetu',
  machines: { laptop: 'notebook', desktop: 'stolní', mini: 'mini', nas: 'nas' },
  yours: 'tvůj',
};

const da: Words = {
  title: 'fortællingen om fleet',
  tagline: 'hvor dine bærbare, stationære og hjemmeservere bliver én stor familie.',
  drift: 'har du mere end én computer,\ner det svært at holde dem ens.',
  rows: ['kodeagenter', 'deres instrukser', 'deres færdigheder', 'ssh-nøgler'],
  ages: ['i dag', 'august', 'ingen'],
  mesh: 'fleet synkroniserer din opsætning til hver maskine,\nog de kan alle frit forbinde til hinanden.',
  agents: 'det er fint at bruge mange forskellige kodeagenter.\nfleet holder dem synkroniserede og opdaterede hver dag.',
  rules: ['pull altid, før du går i gang', 'spørg, før du laver en release'],
  tools: 'du forbinder dine google-, microsoft- og icloud-konti én gang,\nså har alle agenter i fleet adgang.',
  cloud: 'du kan selv hoste din egen cloud-lagring\nog også styre dit fotobibliotek.',
  search: 'kamera kvittering',
  join: 'og meget mere.',
  door: 'slut dig til fleet',
  machines: { laptop: 'bærbar', desktop: 'stationær', mini: 'mini', nas: 'nas' },
  yours: 'din',
};

const de: Words = {
  title: 'die geschichte von fleet',
  tagline: 'wo deine laptops, desktops und heimserver eine große familie werden.',
  drift: 'wenn du mehr als einen computer hast,\nist es schwer, sie gleich zu halten.',
  rows: ['coding-agenten', 'ihre anweisungen', 'ihre skills', 'ssh-schlüssel'],
  ages: ['heute', 'august', 'keine'],
  mesh: 'fleet bringt dein setup auf jede maschine,\nund alle können sich frei miteinander verbinden.',
  agents: 'du kannst ruhig viele verschiedene coding-agenten nutzen.\nfleet hält sie täglich synchron und aktuell.',
  rules: ['vor dem start immer pullen', 'vor einem release erst fragen'],
  tools: 'du verbindest deine google-, microsoft- und icloud-konten einmal,\ndann haben alle agenten in fleet zugriff.',
  cloud: 'du kannst deinen eigenen cloud-speicher selbst hosten\nund auch deine fotomediathek verwalten.',
  search: 'kamera quittung',
  join: 'und noch viel mehr.',
  door: 'komm zu fleet',
  machines: { laptop: 'laptop', desktop: 'desktop', mini: 'mini', nas: 'nas' },
  yours: 'deiner',
};

const es: Words = {
  title: 'el cuento de fleet',
  tagline: 'donde tus portátiles, sobremesas y servidores caseros forman una gran familia.',
  drift: 'si tienes más de un ordenador,\nes difícil mantenerlos iguales.',
  rows: ['agentes de código', 'sus instrucciones', 'sus habilidades', 'claves ssh'],
  ages: ['hoy', 'agosto', 'ninguna'],
  mesh: 'fleet lleva tu configuración a cada máquina,\ny además todas pueden conectarse entre sí libremente.',
  agents: 'puedes usar muchos agentes de código distintos.\nfleet los mantiene sincronizados y al día, a diario.',
  rules: ['haz pull antes de empezar', 'pregunta antes de publicar'],
  tools: 'conectas tus cuentas de google, microsoft e icloud una vez,\ny todos los agentes de fleet ya tienen acceso.',
  cloud: 'puedes alojar tu propio almacenamiento en la nube\ny gestionar también tu biblioteca de fotos.',
  search: 'recibo cámara',
  join: 'y mucho más.',
  door: 'únete a fleet',
  machines: { laptop: 'portátil', desktop: 'sobremesa', mini: 'mini', nas: 'nas' },
  yours: 'el tuyo',
};

const et: Words = {
  title: 'fleeti lugu',
  tagline: 'kus sinu sülearvutid, lauaarvutid ja koduserverid on üks suur pere.',
  drift: 'kui sul on rohkem kui üks arvuti,\non raske neid ühesugusena hoida.',
  rows: ['koodiagendid', 'nende juhised', 'nende oskused', 'ssh-võtmed'],
  ages: ['täna', 'august', 'puudub'],
  mesh: 'fleet viib sinu seadistuse igasse masinasse,\nja nad kõik saavad vabalt üksteisega ühenduda.',
  agents: 'võid julgelt kasutada mitut eri koodiagenti.\nfleet hoiab neid iga päev sünkroonis ja ajakohasena.',
  rules: ['enne alustamist tee alati pull', 'enne väljalaset küsi'],
  tools: 'ühendad oma google’i, microsofti ja icloudi kontod ühe korra,\nja kõigil fleeti agentidel on ligipääs.',
  cloud: 'saad ise majutada oma pilvesalvestust\nja hallata ka oma fotokogu.',
  search: 'kaamera kviitung',
  join: 'ja palju muud.',
  door: 'liitu fleetiga',
  machines: { laptop: 'sülearvuti', desktop: 'lauaarvuti', mini: 'mini', nas: 'nas' },
  yours: 'sinu oma',
};

const fi: Words = {
  title: 'tarina fleetistä',
  tagline: 'missä kannettavasi, pöytäkoneesi ja kotipalvelimesi ovat yhtä suurta perhettä.',
  drift: 'jos sinulla on useampi kuin yksi tietokone,\nniitä on vaikea pitää samanlaisina.',
  rows: ['koodausagentit', 'niiden ohjeet', 'niiden taidot', 'ssh-avaimet'],
  ages: ['tänään', 'elokuu', 'ei ole'],
  mesh: 'fleet synkronoi asetuksesi jokaiselle koneelle,\nja koneet pääsevät vapaasti toisiinsa.',
  agents: 'voit hyvin käyttää montaa eri koodausagenttia.\nfleet pitää ne synkronoituina ja ajan tasalla joka päivä.',
  rules: ['tee aina pull ennen kuin aloitat', 'kysy ennen kuin teet julkaisun'],
  tools: 'yhdistät google-, microsoft- ja icloud-tilisi kerran,\nja kaikilla fleetin agenteilla on pääsy niihin.',
  cloud: 'voit ylläpitää omaa pilvitallennustilaasi itse\nja hallita myös kuvakirjastoasi.',
  search: 'kamera kuitti',
  join: 'ja paljon muuta.',
  door: 'liity fleetiin',
  machines: { laptop: 'kannettava', desktop: 'pöytäkone', mini: 'mini', nas: 'nas' },
  yours: 'sinun',
};

const fr: Words = {
  title: 'le conte de fleet',
  tagline: 'là où tes portables, tes ordinateurs de bureau et tes serveurs maison forment une grande famille.',
  drift: 'si tu as plus d’un ordinateur,\nc’est difficile de les garder identiques.',
  rows: ['agents de code', 'leurs instructions', 'leurs compétences', 'clés ssh'],
  ages: ['aujourd’hui', 'août', 'aucune'],
  mesh: 'fleet copie ta configuration sur chaque machine,\net en plus elles peuvent toutes se connecter librement entre elles.',
  agents: 'tu peux utiliser plein d’agents de code différents.\nfleet les garde synchronisés et à jour chaque jour.',
  rules: ['pull avant de commencer', 'demander avant de publier'],
  tools: 'tu connectes tes comptes google, microsoft et icloud une fois,\net tous les agents de fleet y ont accès.',
  cloud: 'tu peux héberger toi-même ton stockage cloud\net gérer aussi ta photothèque.',
  search: 'reçu appareil photo',
  join: 'et bien plus encore.',
  door: 'rejoins fleet',
  machines: { laptop: 'portable', desktop: 'bureau', mini: 'mini', nas: 'nas' },
  yours: 'le tien',
};

const hi: Words = {
  title: 'fleet की कहानी',
  tagline: 'जहाँ आपके लैपटॉप, डेस्कटॉप और होम सर्वर एक बड़ा परिवार बन जाते हैं।',
  drift: 'अगर आपके पास एक से ज़्यादा कंप्यूटर हैं,\nतो उन्हें एक जैसा रखना मुश्किल है।',
  rows: ['कोडिंग एजेंट', 'उनके निर्देश', 'उनकी स्किल', 'ssh कुंजियाँ'],
  ages: ['आज', 'अगस्त', 'नहीं है'],
  mesh: 'fleet आपका सेटअप हर मशीन पर सिंक करता है,\nऔर सभी मशीनें एक-दूसरे से खुलकर जुड़ सकती हैं।',
  agents: 'कई अलग-अलग कोडिंग एजेंट इस्तेमाल करना ठीक है।\nfleet उन्हें रोज़ सिंक और अप-टू-डेट रखता है।',
  rules: ['शुरू करने से पहले हमेशा pull करें', 'रिलीज़ बनाने से पहले पूछें'],
  tools: 'आप अपने google, microsoft, icloud खाते एक बार जोड़ते हैं,\nफिर fleet के सभी एजेंट उन तक पहुँच सकते हैं।',
  cloud: 'आप अपना क्लाउड स्टोरेज खुद होस्ट कर सकते हैं\nऔर अपनी फ़ोटो लाइब्रेरी भी सँभाल सकते हैं।',
  search: 'कैमरा रसीद',
  join: 'और भी बहुत कुछ।',
  door: 'fleet से जुड़ें',
  machines: { laptop: 'लैपटॉप', desktop: 'डेस्कटॉप', mini: 'मिनी', nas: 'nas' },
  yours: 'आपका',
};

const hr: Words = {
  title: 'priča o fleetu',
  tagline: 'gdje tvoji laptopi, stolna računala i kućni serveri postaju jedna velika obitelj.',
  drift: 'ako imaš više od jednog računala,\nteško ih je držati usklađenima.',
  rows: ['agenti za kodiranje', 'njihove upute', 'njihove vještine', 'ssh ključevi'],
  ages: ['danas', 'kolovoz', 'nema'],
  mesh: 'fleet prenosi tvoje postavke na svako računalo,\na sva se mogu slobodno spajati jedno na drugo.',
  agents: 'slobodno koristi više različitih agenata za kodiranje.\nfleet ih svaki dan sinkronizira i ažurira.',
  rules: ['uvijek napravi pull prije početka', 'pitaj prije objave izdanja'],
  tools: 'svoje google, microsoft i icloud račune povežeš jednom,\ni svi agenti u fleetu imaju pristup.',
  cloud: 'možeš sam hostati vlastitu pohranu u oblaku\ni upravljati svojom zbirkom fotografija.',
  search: 'račun fotoaparat',
  join: 'i još mnogo toga.',
  door: 'pridruži se fleetu',
  machines: { laptop: 'laptop', desktop: 'stolno', mini: 'mini', nas: 'nas' },
  yours: 'tvoje',
};

const hu: Words = {
  title: 'a fleet meséje',
  tagline: 'ahol a laptopjaid, asztali gépeid és otthoni szervereid egy nagy családot alkotnak.',
  drift: 'ha egynél több számítógéped van,\nnehéz őket egyformán tartani.',
  rows: ['kódoló ágensek', 'az utasításaik', 'a képességeik', 'ssh-kulcsok'],
  ages: ['ma', 'augusztus', 'nincs'],
  mesh: 'a fleet minden gépre átviszi a beállításaidat,\nráadásul a gépek szabadon elérik egymást.',
  agents: 'nyugodtan használj többféle kódoló ágenst.\na fleet naponta szinkronban és frissen tartja őket.',
  rules: ['kezdés előtt mindig pullolj', 'kiadás előtt kérdezz'],
  tools: 'egyszer kötöd be a google-, microsoft- és icloud-fiókodat,\nés a fleet minden ágense hozzájuk fér.',
  cloud: 'saját magad üzemeltetheted a felhőtárhelyedet,\nés a fotótáradat is kezelheted.',
  search: 'kamera számla',
  join: 'és még sok minden más.',
  door: 'csatlakozz a fleethez',
  machines: { laptop: 'laptop', desktop: 'asztali', mini: 'mini', nas: 'nas' },
  yours: 'a tiéd',
};

const it: Words = {
  title: 'la storia di fleet',
  tagline: 'dove i tuoi portatili, i desktop e i server di casa formano una grande famiglia.',
  drift: 'se hai più di un computer,\nè difficile tenerli uguali.',
  rows: ['agenti di codice', 'le loro istruzioni', 'le loro skill', 'chiavi ssh'],
  ages: ['oggi', 'agosto', 'nessuna'],
  mesh: 'fleet porta la tua configurazione su ogni macchina,\ne in più possono tutte collegarsi liberamente tra loro.',
  agents: 'puoi usare tranquillamente tanti agenti di codice diversi.\nfleet li tiene sincronizzati e aggiornati ogni giorno.',
  rules: ['fai sempre pull prima di iniziare', 'chiedi prima di fare una release'],
  tools: 'colleghi i tuoi account google, microsoft e icloud una volta,\ne tutti gli agenti di fleet hanno accesso.',
  cloud: 'puoi ospitare da te il tuo spazio cloud\ne gestire anche la tua libreria di foto.',
  search: 'ricevuta fotocamera',
  join: 'e molto altro.',
  door: 'unisciti a fleet',
  machines: { laptop: 'portatile', desktop: 'desktop', mini: 'mini', nas: 'nas' },
  yours: 'il tuo',
};

// Japanese and Chinese have no spaces to break a line at, so `|` marks where
// one may fall (between phrases) and nowhere else is allowed to (`keep-all`
// in index.css).
const ja: Words = phrased({
  title: 'フリート物語',
  tagline: 'ノートパソコンも、|デスクトップも、|ホームサーバーも、|ひとつの|大きな|家族になる|場所。',
  drift: 'パソコンが|二台以上あると、\n同じ設定に|そろえておくのは|大変です。',
  rows: ['エージェント', '指示', 'スキル', 'ssh 鍵'],
  ages: ['今日', '8月', 'なし'],
  mesh: 'フリートは|設定を|すべてのマシンに|同期します。\nそして、|マシン同士は|自由に|行き来できます。',
  agents: 'いろいろな|コーディングエージェントを|使っても|大丈夫。\nフリートが|毎日、|同期して|最新にしてくれます。',
  rules: ['始める前に必ず pull する', 'リリースの前に確認する'],
  tools: 'google、|microsoft、|icloud の|アカウントを|一度つなぐだけで、\nフリートの|すべてのエージェントが|使えるようになります。',
  cloud: '自分だけの|クラウドストレージを|自分でホストして、\n写真ライブラリも|管理できます。',
  search: 'カメラ 領収書',
  join: 'ほかにも、|まだまだたくさん。',
  door: 'フリートに参加する',
  machines: { laptop: 'ノート', desktop: 'デスクトップ', mini: 'ミニ', nas: 'nas' },
  yours: 'あなたの',
});

const nb: Words = {
  title: 'fortellingen om fleet',
  tagline: 'der de bærbare, stasjonære og hjemmeserverne dine blir én stor familie.',
  drift: 'har du mer enn én datamaskin,\ner det vanskelig å holde dem like.',
  rows: ['kodeagenter', 'instruksene deres', 'ferdighetene deres', 'ssh-nøkler'],
  ages: ['i dag', 'august', 'ingen'],
  mesh: 'fleet synkroniserer oppsettet ditt til hver maskin,\nog alle kan fritt koble seg til hverandre.',
  agents: 'det går fint å bruke mange ulike kodeagenter.\nfleet holder dem synkronisert og oppdatert hver dag.',
  rules: ['pull alltid før du begynner', 'spør før du lager en release'],
  tools: 'du kobler til google-, microsoft- og icloud-kontoene dine én gang,\nså har alle agentene i fleet tilgang.',
  cloud: 'du kan drifte din egen skylagring selv\nog holde orden på bildebiblioteket ditt også.',
  search: 'kamera kvittering',
  join: 'og mye mer.',
  door: 'bli med i fleet',
  machines: { laptop: 'bærbar', desktop: 'stasjonær', mini: 'mini', nas: 'nas' },
  yours: 'din',
};

const nl: Words = {
  title: 'het verhaal van fleet',
  tagline: 'waar je laptops, desktops en thuisservers één grote familie vormen.',
  drift: 'als je meer dan één computer hebt,\nis het lastig ze gelijk te houden.',
  rows: ['coding agents', 'hun instructies', 'hun skills', 'ssh-sleutels'],
  ages: ['vandaag', 'augustus', 'geen'],
  mesh: 'fleet zet je setup op elke machine,\nen ze kunnen allemaal vrij met elkaar verbinden.',
  agents: 'je mag gerust veel verschillende coding agents gebruiken.\nfleet houdt ze elke dag gesynchroniseerd en up-to-date.',
  rules: ['eerst pullen, dan beginnen', 'vraag het voor een release'],
  tools: 'je koppelt je google-, microsoft- en icloud-accounts één keer,\nen alle agents in fleet hebben toegang.',
  cloud: 'je kunt je eigen cloudopslag zelf hosten\nen ook je fotobibliotheek beheren.',
  search: 'camera bonnetje',
  join: 'en nog veel meer.',
  door: 'sluit je aan bij fleet',
  machines: { laptop: 'laptop', desktop: 'desktop', mini: 'mini', nas: 'nas' },
  yours: 'de jouwe',
};

const pl: Words = {
  title: 'opowieść o fleet',
  tagline: 'gdzie twoje laptopy, komputery stacjonarne i domowe serwery tworzą jedną wielką rodzinę.',
  drift: 'gdy masz więcej niż jeden komputer,\ntrudno utrzymać je takie same.',
  rows: ['agenci kodujący', 'ich instrukcje', 'ich umiejętności', 'klucze ssh'],
  ages: ['dziś', 'sierpień', 'brak'],
  mesh: 'fleet przenosi twoją konfigurację na każdą maszynę,\na do tego wszystkie mogą się swobodnie ze sobą łączyć.',
  agents: 'śmiało używaj wielu różnych agentów kodujących.\nfleet codziennie je synchronizuje i aktualizuje.',
  rules: ['najpierw zawsze zrób pull', 'zapytaj przed wydaniem'],
  tools: 'konta google, microsoft i icloud podłączasz raz,\ni wszyscy agenci we fleet mają już dostęp.',
  cloud: 'możesz sam hostować własną chmurę na pliki\ni zarządzać też biblioteką zdjęć.',
  search: 'paragon aparat',
  join: 'i dużo, dużo więcej.',
  door: 'dołącz do fleet',
  machines: { laptop: 'laptop', desktop: 'stacjonarny', mini: 'mini', nas: 'nas' },
  yours: 'twój',
};

const ptBR: Words = {
  title: 'o conto do fleet',
  tagline: 'onde seus notebooks, desktops e servidores de casa formam uma grande família.',
  drift: 'se você tem mais de um computador,\né difícil manter todos iguais.',
  rows: ['agentes de código', 'suas instruções', 'suas habilidades', 'chaves ssh'],
  ages: ['hoje', 'agosto', 'nenhuma'],
  mesh: 'o fleet leva sua configuração para cada máquina,\ne todas ainda podem se conectar umas às outras livremente.',
  agents: 'tudo bem usar vários agentes de código diferentes.\no fleet mantém todos sincronizados e atualizados todo dia.',
  rules: ['sempre dê pull antes de começar', 'pergunte antes de lançar'],
  tools: 'você conecta suas contas google, microsoft e icloud uma vez,\ne todos os agentes do fleet já têm acesso.',
  cloud: 'você pode hospedar seu próprio armazenamento em nuvem\ne cuidar da sua biblioteca de fotos também.',
  search: 'recibo câmera',
  join: 'e muito mais.',
  door: 'entre para o fleet',
  machines: { laptop: 'notebook', desktop: 'desktop', mini: 'mini', nas: 'nas' },
  yours: 'o seu',
};

const ptPT: Words = {
  title: 'o conto do fleet',
  tagline: 'onde os teus portáteis, computadores de secretária e servidores caseiros formam uma grande família.',
  drift: 'se tens mais do que um computador,\né difícil mantê-los iguais.',
  rows: ['agentes de código', 'as suas instruções', 'as suas competências', 'chaves ssh'],
  ages: ['hoje', 'agosto', 'nenhuma'],
  mesh: 'o fleet leva a tua configuração para cada máquina,\ne todas podem ainda ligar-se umas às outras livremente.',
  agents: 'podes usar vários agentes de código diferentes.\no fleet mantém-nos sincronizados e atualizados todos os dias.',
  rules: ['faz sempre pull antes de começar', 'pergunta antes de lançar'],
  tools: 'ligas as tuas contas google, microsoft e icloud uma vez,\ne todos os agentes do fleet passam a ter acesso.',
  cloud: 'podes alojar o teu próprio armazenamento na nuvem\ne gerir também a tua biblioteca de fotos.',
  search: 'recibo câmara',
  join: 'e muito mais.',
  door: 'junta-te ao fleet',
  machines: { laptop: 'portátil', desktop: 'secretária', mini: 'mini', nas: 'nas' },
  yours: 'o teu',
};

const ro: Words = {
  title: 'povestea fleet',
  tagline: 'unde laptopurile, desktopurile și serverele tale de acasă devin o mare familie.',
  drift: 'dacă ai mai mult de un calculator,\ne greu să le ții la fel.',
  rows: ['agenți de cod', 'instrucțiunile lor', 'abilitățile lor', 'chei ssh'],
  ages: ['azi', 'august', 'lipsă'],
  mesh: 'fleet îți duce configurarea pe fiecare mașină,\niar toate se pot conecta liber între ele.',
  agents: 'poți folosi fără grijă mai mulți agenți de cod.\nfleet îi ține sincronizați și la zi, în fiecare zi.',
  rules: ['fă mereu pull înainte să începi', 'întreabă înainte de o lansare'],
  tools: 'îți conectezi conturile google, microsoft și icloud o singură dată,\niar toți agenții din fleet au acces.',
  cloud: 'îți poți găzdui singur propriul spațiu de stocare în cloud\nși îți poți organiza și biblioteca de fotografii.',
  search: 'bon cameră foto',
  join: 'și multe altele.',
  door: 'intră în fleet',
  machines: { laptop: 'laptop', desktop: 'desktop', mini: 'mini', nas: 'nas' },
  yours: 'al tău',
};

const ru: Words = {
  title: 'сказка о fleet',
  tagline: 'где твои ноутбуки, настольные компьютеры и домашние серверы становятся одной большой семьёй.',
  drift: 'если у тебя больше одного компьютера,\nтрудно держать их одинаковыми.',
  rows: ['кодинг-агенты', 'их инструкции', 'их навыки', 'ssh-ключи'],
  ages: ['сегодня', 'август', 'нет'],
  mesh: 'fleet переносит твои настройки на каждую машину,\nа ещё все они могут свободно подключаться друг к другу.',
  agents: 'можно спокойно пользоваться разными кодинг-агентами.\nfleet каждый день синхронизирует и обновляет их.',
  rules: ['сначала всегда делай pull', 'спроси перед релизом'],
  tools: 'ты один раз подключаешь аккаунты google, microsoft и icloud,\nи у всех агентов во fleet уже есть доступ.',
  cloud: 'можно самому держать своё облачное хранилище\nи вести свою фототеку.',
  search: 'чек фотоаппарат',
  join: 'и ещё многое другое.',
  door: 'присоединиться к fleet',
  machines: { laptop: 'ноутбук', desktop: 'настольный', mini: 'мини', nas: 'nas' },
  yours: 'твой',
};

const sk: Words = {
  title: 'príbeh fleetu',
  tagline: 'kde tvoje notebooky, stolné počítače a domáce servery tvoria jednu veľkú rodinu.',
  drift: 'keď máš viac než jeden počítač,\nje ťažké udržať ich rovnaké.',
  rows: ['kódovací agenti', 'ich inštrukcie', 'ich zručnosti', 'ssh kľúče'],
  ages: ['dnes', 'august', 'nič'],
  mesh: 'fleet prenesie tvoje nastavenia na každý stroj,\na všetky sa navyše môžu voľne pripájať jeden k druhému.',
  agents: 'pokojne používaj viac rôznych kódovacích agentov.\nfleet ich každý deň synchronizuje a aktualizuje.',
  rules: ['pred začiatkom vždy urob pull', 'pred vydaním verzie sa opýtaj'],
  tools: 'účty google, microsoft a icloud pripojíš raz,\na prístup majú hneď všetci agenti vo fleete.',
  cloud: 'môžeš si sám hostovať vlastné cloudové úložisko\na spravovať aj knižnicu fotiek.',
  search: 'bloček fotoaparát',
  join: 'a oveľa viac.',
  door: 'pridaj sa k fleetu',
  machines: { laptop: 'notebook', desktop: 'stolný', mini: 'mini', nas: 'nas' },
  yours: 'tvoj',
};

const sv: Words = {
  title: 'sagan om fleet',
  tagline: 'där dina bärbara, stationära och hemservrar blir en enda stor familj.',
  drift: 'har du mer än en dator,\när det svårt att hålla dem likadana.',
  rows: ['kodagenter', 'deras instruktioner', 'deras färdigheter', 'ssh-nycklar'],
  ages: ['i dag', 'augusti', 'inga'],
  mesh: 'fleet synkar din setup till varje maskin,\noch alla kan fritt ansluta till varandra.',
  agents: 'det går bra att använda många olika kodagenter.\nfleet håller dem synkade och uppdaterade varje dag.',
  rules: ['gör alltid pull innan du börjar', 'fråga innan du gör en release'],
  tools: 'du kopplar dina google-, microsoft- och icloud-konton en gång,\nsedan har alla agenter i fleet åtkomst.',
  cloud: 'du kan själv drifta din egen molnlagring\noch sköta ditt fotobibliotek också.',
  search: 'kamera kvitto',
  join: 'och mycket mer.',
  door: 'gå med i fleet',
  machines: { laptop: 'bärbar', desktop: 'stationär', mini: 'mini', nas: 'nas' },
  yours: 'din',
};

const tr: Words = {
  title: 'fleet masalı',
  tagline: 'dizüstülerinin, masaüstülerinin ve ev sunucularının kocaman bir aile olduğu yer.',
  drift: 'birden fazla bilgisayarın varsa,\nonları aynı tutmak zor.',
  rows: ['kodlama ajanları', 'talimatları', 'becerileri', 'ssh anahtarları'],
  ages: ['bugün', 'ağustos', 'yok'],
  mesh: 'fleet kurulumunu her makineye eşitler,\nüstelik hepsi birbirine serbestçe bağlanıp erişebilir.',
  agents: 'birçok farklı kodlama ajanı kullanman sorun değil.\nfleet onları her gün eşitler ve güncel tutar.',
  rules: ['başlamadan önce hep pull yap', 'sürüm çıkarmadan önce sor'],
  tools: 'google, microsoft ve icloud hesaplarını bir kez bağlarsın,\nfleet’teki bütün ajanlar erişir.',
  cloud: 'kendi bulut depolamanı kendin barındırabilir,\nfotoğraf arşivini de yönetebilirsin.',
  search: 'kamera fişi',
  join: 've çok daha fazlası.',
  door: 'fleet’e katıl',
  machines: { laptop: 'dizüstü', desktop: 'masaüstü', mini: 'mini', nas: 'nas' },
  yours: 'seninki',
};

const uk: Words = {
  title: 'казка про fleet',
  tagline: 'де твої ноутбуки, настільні комп’ютери й домашні сервери стають однією великою родиною.',
  drift: 'якщо в тебе більше одного комп’ютера,\nважко тримати їх однаковими.',
  rows: ['кодинг-агенти', 'їхні інструкції', 'їхні навички', 'ssh-ключі'],
  ages: ['сьогодні', 'серпень', 'немає'],
  mesh: 'fleet переносить твої налаштування на кожну машину,\nа ще всі вони можуть вільно під’єднуватися одна до одної.',
  agents: 'можна спокійно користуватися різними кодинг-агентами.\nfleet щодня синхронізує та оновлює їх.',
  rules: ['спершу завжди роби pull', 'спитай перед релізом'],
  tools: 'ти один раз під’єднуєш акаунти google, microsoft та icloud,\nі всі агенти у fleet уже мають доступ.',
  cloud: 'можна самому тримати власне хмарне сховище\nй упорядковувати свою фототеку.',
  search: 'чек фотоапарат',
  join: 'і ще багато іншого.',
  door: 'приєднатися до fleet',
  machines: { laptop: 'ноутбук', desktop: 'настільний', mini: 'міні', nas: 'nas' },
  yours: 'твій',
};

const vi: Words = {
  title: 'chuyện kể về fleet',
  tagline: 'nơi laptop, máy bàn và máy chủ tại nhà của bạn trở thành một đại gia đình.',
  drift: 'nếu bạn có nhiều hơn một máy tính,\nthật khó để giữ chúng giống nhau.',
  rows: ['coding agent', 'chỉ dẫn', 'kỹ năng', 'khóa ssh'],
  ages: ['hôm nay', 'tháng 8', 'chưa có'],
  mesh: 'fleet đồng bộ thiết lập của bạn tới mọi máy,\nvà các máy còn có thể tự do kết nối, truy cập lẫn nhau.',
  agents: 'dùng nhiều coding agent khác nhau cũng không sao.\nfleet giữ cho chúng đồng bộ và cập nhật mỗi ngày.',
  rules: ['luôn pull trước khi bắt đầu', 'hỏi trước khi phát hành'],
  tools: 'bạn kết nối tài khoản google, microsoft, icloud một lần,\nlà mọi agent trong fleet đều dùng được.',
  cloud: 'bạn có thể tự host kho lưu trữ đám mây của riêng mình\nvà quản lý cả thư viện ảnh nữa.',
  search: 'hóa đơn máy ảnh',
  join: 'và còn nhiều nữa.',
  door: 'gia nhập fleet',
  machines: { laptop: 'laptop', desktop: 'máy bàn', mini: 'mini', nas: 'nas' },
  yours: 'máy của bạn',
};

const zhHans: Words = phrased({
  title: 'fleet 的故事',
  tagline: '在这里，|你的笔记本、|台式机和|家庭服务器|成为|一个大家庭。',
  drift: '如果你有|不止一台电脑，\n就很难让它们|保持一致。',
  rows: ['编程智能体', '它们的指令', '它们的技能', 'ssh 密钥'],
  ages: ['今天', '8月', '没有'],
  mesh: 'fleet 把你的配置|同步到|每一台机器，\n而且它们之间|可以自由连接、|互相访问。',
  agents: '同时用很多种|编程智能体|也没关系。\nfleet 每天|让它们|保持同步|和最新。',
  rules: ['开始之前先 pull', '发布版本前先问一声'],
  tools: '你的 google、|microsoft、|icloud 账号|只需连接一次，\nfleet 里的|所有智能体|就都能用了。',
  cloud: '你可以自己托管|自己的云存储，\n还能管理|你的照片库。',
  search: '相机 收据',
  join: '还有更多。',
  door: '加入 fleet',
  machines: { laptop: '笔记本', desktop: '台式机', mini: '迷你', nas: 'nas' },
  yours: '你的',
});

const ALL = {
  en, ar, bg, cs, da, de, es, et, fi, fr, hi, hr, hu, it, ja, ko, nb, nl, pl,
  'pt-BR': ptBR, 'pt-PT': ptPT, ro, ru, sk, sv, tr, uk, vi, 'zh-Hans': zhHans,
};
type Lang = keyof typeof ALL;

// what a browser may call a language that goes by another name here
const ALSO: Record<string, Lang> = { pt: 'pt-BR', no: 'nb', nn: 'nb', zh: 'zh-Hans' };

/** the catalog for a language tag: its own, or its language's without the
    region. Traditional Chinese has none, and is not given the simplified one. */
function find(tag: string): Lang | undefined {
  if (/^zh-(hant|tw|hk|mo)/i.test(tag)) return;
  const named = (name: string) =>
    (Object.keys(ALL) as Lang[]).find((l) => l.toLowerCase() === name) ?? ALSO[name];
  const low = tag.toLowerCase();
  return named(low) ?? named(low.split('-')[0]);
}

const hasBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const asked = hasBrowser ? new URLSearchParams(location.search).get('lang') : null;
const navLangs = typeof navigator !== 'undefined' ? navigator.languages : [];

export const LANG: Lang = [...(asked ? [asked] : []), ...navLangs].map(find).find(Boolean) ?? 'en';
export const t = ALL[LANG];

// The hand a language is written in, where Gaegu has no letters for it
// (see index.css). Only the reader's own is fetched.
const HANDS: Partial<Record<Lang, () => Promise<unknown>>> = {
  en: async () => {},
  ko: async () => {},
  ja: () => import('@fontsource/yomogi/400.css'),
  'zh-Hans': () => import('lxgw-wenkai-webfont/lxgwwenkai-light.css'),
  hi: () => import('@fontsource/kalam/300.css'),
  ar: () => import('@fontsource/playpen-sans-arabic/300.css'),
};
export const handReady: Promise<unknown> = hasBrowser
  ? (HANDS[LANG] ?? (() => import('@fontsource/playpen-sans/300.css')))().catch(() => {})
  : Promise.resolve();

if (hasBrowser) {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = `${t.title} · lost.plus`;
}
