🌍 [English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · [Italiano](README.it.md) · **Türkçe**

# 🎅🏻 Secret Santa

Arkadaşlar, iş arkadaşları veya aile arasında Secret Santa (Yılbaşı Hediyeleşmesi) düzenlemek için bir web uygulaması. Ayrıca Noel filmlerinden oluşan bir advent takvimi içerir.

- **Organizatör** grubu oluşturur; gizli bir yönetici bağlantısı ve diğerleri için bir davet bağlantısı alır.
- **Katılımcılar** adları, e-postaları ve bir dilek listesiyle kaydolur.
- **Çekilişte** herkes, hediye alacağı kişiyi ve o kişinin dilek listesini içeren bir e-posta alır.
- **Eşleşmeleri kimse göremez, organizatör bile**; böylece o da katılabilir.

E-postalar, bir uygulama şifresi (App Password) ile doğrudan organizatörün **Gmail veya Yahoo** hesabından gönderilir.

## Özellikler

- 🔒 **Her şey gizli kalır:** eşleşmeler ve dilek listeleri yalnızca e-postayla, herkese ayrı ayrı gider.
- 🎲 **Adil çekiliş:** kimse kendini çekmez ve her geçerli kombinasyonun şansı eşittir.
- 📬 **Güvenilir e-postalar:** veritabanında saklanan bir kuyruktan arka planda gönderilir. Sunucu durursa gönderim kaldığı yerden, tekrar olmadan devam eder.
- 🧹 **Kişisel veriler silinir:** herkes e-postasını aldıktan sonra (bkz. [Kişisel veriler](#kişisel-veriler)).
- ⏳ **Yönetici bağlantısının süresi dolar:** herkes e-postasını aldıktan sonra.
- 🎬 **Advent takvimi:** 1–25 Aralık arasında her kapının arkasında bir Noel filmi, ayrıca 26'sında bir bonus kapı (bkz. [Advent takvimi](#advent-takvimi)).
- 🎄 **İki tema:** klasik (Noel Baba, süsler) ve 🐱 kediler (Noel Baba ve elf kılığında kediler, yün yumakları).
- 🌍 **Beş dil:** İngilizce (varsayılan), Romence, Fransızca, Türkçe ve İtalyanca. Her katılımcı e-postasını kaydolduğu dilde alır.
- 📊 Kişisel veri içermeyen genel **istatistikler**.
- 📱 **Telefonda:** arayüz ekrana uyum sağlar ve "hareketi azalt" ayarına uyar.

## Teknolojiler

| Bölüm | Kullanılan |
|---|---|
| Backend | Python 3.12, Flask, SQLAlchemy, PostgreSQL 17, gunicorn |
| Frontend | React 19, TypeScript, Vite, Ant Design 6 |
| Çalıştırma | Docker ve Docker Compose |

## Geliştirme ortamı

**Docker Desktop**, **Python 3.12** ve **Node.js 22** gerekir.

**1. Yapılandırma.** `.env.example` dosyasını `.env` olarak kopyalayın ve `SECRET_KEY` ile `POSTGRES_PASSWORD` değerlerini doldurun. Dosya bunların nasıl üretileceğini açıklar.

```bash
cp .env.example .env
```

**2. Veritabanı** (Docker'da Postgres, yalnızca kendi bilgisayarınızdan erişilebilir):

```bash
docker compose up -d db
```

**3. Backend** (`localhost:5000` üzerinde):

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python run.py
```

macOS veya Linux'ta `.venv/Scripts/` yerine `.venv/bin/` kullanın.

**4. E-posta gönderen süreç**, ikinci bir terminalde. O olmadan e-postalar kuyrukta kalır:

```bash
.venv/Scripts/python email_worker.py
```

**5. Frontend** (`localhost:5173` üzerinde):

```bash
cd frontend
npm ci
npm run dev
```

### Veritabanına bağlanma (DataGrip, DBeaver…)

| Alan | Değer |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| User | `santa` |
| Password | `.env` içindeki `POSTGRES_PASSWORD` |
| Database | `santa` |

Kullanıcı adı `santa`'dır, konteynerin adı değil. Programda bir URL alanı da varsa, yukarıdaki alanların yerine o geçerlidir: `jdbc:postgresql://127.0.0.1:5432/santa` yazın.

## Tamamen Docker'da çalıştırma

Frontend'i derler ve sunucuyu e-posta süreciyle birlikte, üretimdeki gibi başlatır:

```bash
docker compose -f docker-compose.yml up -d --build
```

Uygulama `http://localhost:8000` adresindedir.

## Cloudflare tüneliyle yayınlama

Uygulama, hesap gerektirmeyen ücretsiz bir Cloudflare tüneliyle internete açılabilir. Hem kendi bilgisayarınızdan hem de bir sunucudan çalışır:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d --build
```

Herkese açık bağlantı (`https://….trycloudflare.com`) tünelin loglarında görünür:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs tunnel
```

Bilmeniz gerekenler:
- **Bağlantı yalnızca makine açıkken çalışır** ve tünel her yeniden başladığında yeni bir bağlantı alırsınız.
- **Her komutta iki dosyayı da verin** (`-f docker-compose.yml -f docker-compose.public.yml`). Yalnızca ilkiyle, `web` konteyneri tünel ayarları olmadan başlar ve Docker tüneli "orphan container" olarak bildirir. **Bu durumda asla `--remove-orphans` kullanmayın**: tüneli durdurur.

## Sunucuyu güncelleme

Sunucuda yalnızca `docker-compose.yml`, `docker-compose.public.yml` ve `.env` varsa (kaynak kod yoksa), imaj sizin bilgisayarınızda oluşturulur ve oraya kopyalanır.

**1. Bilgisayarınızda** imajı oluşturup dışa aktarın:

```bash
docker compose -f docker-compose.yml build web
docker save secret-santa-web:latest | gzip > santa-web.tar.gz
tar czf movies.tar.gz movies        # yalnızca filmler değiştiyse
```

**2.** `santa-web.tar.gz` (ve `movies.tar.gz`) dosyalarını sunucuya **yükleyin**; örneğin bulut sağlayıcının SSH penceresindeki "Upload file" düğmesiyle ya da `scp` ile.

**3. Sunucuda**, `docker-compose.yml` dosyasının bulunduğu klasörde:

```bash
# önce yedek: güncelleme kişisel verileri silebilir ve bu geri alınamaz
docker compose exec -T db pg_dump -U santa santa | gzip > ~/backup-before-update.sql.gz

# yeni sürüm
gunzip -c ~/santa-web.tar.gz | docker load
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --tail=50 web

# filmler (yalnızca değiştiyse)
tar xzf ~/movies.tar.gz -C ~
docker compose -f docker-compose.yml -f docker-compose.public.yml run --rm \
  -v "$HOME/movies:/movies:ro" web python advent_import.py /movies
```

Yeni yüklediğiniz imajın kullanılması için `up -d` komutunu `--build` **olmadan** çalıştırın. Veritabanı değişiklikleri (yeni sütunlar ve tablolar) başlangıçta otomatik uygulanır.

**4. Her şey çalıştıktan sonra** yedeği ve yüklenen dosyaları silin. Yedek, az önce silinen kişisel verileri hâlâ içerir.

```bash
rm ~/backup-before-update.sql.gz ~/santa-web.tar.gz ~/movies.tar.gz
rm -r ~/movies
```

## Advent takvimi

`/advent` sayfası (menüde 🎬), 1–25 Aralık arasındaki her gün için bir tane olmak üzere 25 kapı gösterir; her kapının arkasında bir Noel filmi vardır.

- **Geçmiş günler** açıktır; **bugünün kapısı** bir tıklamayla açılır (animasyon ve konfeti); **gelecek günler** kilitlidir 🔒.
- **1 Aralık'tan önce** her şey kilitlidir ve bir geri sayım görünür; **26 Aralık'tan sonra** her şey açıktır.
- **Bonus kapı:** 25 Aralık'ta bir 🎁 kapısı belirir ve 26'sında açılır.
- **Tarihe sunucu karar verir**, Romanya saatine göre (`Europe/Bucharest`; `.env` içinde `ADVENT_TIMEZONE` ile değiştirilebilir). Gelecek günlerin filmleri tarayıcıya hiç ulaşmaz, bu yüzden bilgisayarın saatini değiştirmek hiçbir şeyi açmaz.
- **İki görünüm:** 🚪 Takvim (gerçek bir takvimdeki gibi karışık sırada kapılar) ve 🎬 Günün filmi.

### Filmleri değiştirme

Filmler, **git'te olmayan** `movies/` klasöründedir. Bir kopyasını saklayın: listenin ve orijinal afişlerin tek kopyası odur.

- `movies/christmas_movies.json`: her gün için bir tane olmak üzere 26 kayıt (`day` 1–26).
- `cover` alanının gösterdiği afişler.

Her kayıt:

```json
{
  "day": 15,
  "title": "Tom & Jerry: A Nutcracker Tale",
  "url_IMDB": "https://www.imdb.com/title/tt1114698",
  "cover": "Tom_and_Jerry_A_Nutcracker_Tale_cover.jpg",
  "trailer_link": "https://www.youtube.com/...",
  "movie_link": "https://tv.apple.com/..."
}
```

`day`, `title` ve `cover` zorunludur; bağlantılar `https` olmalıdır. Veritabanına aktarma (veya güncelleme):

```bash
.venv/Scripts/python advent_import.py movies/ --dry-run   # yalnızca kontrol eder
.venv/Scripts/python advent_import.py movies/
```

Afişler WebP'ye dönüştürülür (en fazla 400×600) ve **veritabanında saklanır**. Aktarımdan sonra uygulamanın `movies/` klasörüne ihtiyacı kalmaz: onu sunucudan silebilirsiniz, afişler görünmeye devam eder.

## Kişisel veriler

Kişisel veriler yalnızca gerektiği sürece saklanır:

- **Son e-posta başarıyla gönderildikten hemen sonra** grup anonimleştirilir: katılımcıların adları, e-postaları, dilek listeleri ve eşleşmeleri, organizatörün e-posta ayarları ve şifresi ile grubun adı ("Secret Santa" olur).
- **Bir e-posta başarısız ya da belirsizken hiçbir şey silinmez**, böylece organizatör yeniden gönderebilir.
- **1 Şubat güvenlik ağı:** önceki bir sezona ait her grup, durumu ne olursa olsun anonimleştirilir (örneğin e-postasız bir grup ya da hiç gitmemiş bir e-postası olan grup).
- Temizlik, sunucu başlarken ve e-posta sürecinde her 15 dakikada bir çalışır.
- Anonimleştirilmiş bir grup kapanır: yönetici bağlantısı "süresi doldu" yanıtı verir ve kayıtlar reddedilir.
- **Genel istatistikler doğru kalır:** satırlar durur, yalnızca kişisel veriler olmadan.

Temizlikten önce alınan veritabanı yedekleri (`pg_dump`) verileri hâlâ içerir ve elle silinmelidir.

Sunucuda kişisel bir şey kalmadığını kontrol edin:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml exec -T db psql -U santa -d santa -c "
SELECT g.id, g.name, g.personal_data_erased_at AS silinme_tarihi, count(p.id) AS katilimci,
       count(p.name) + count(p.email) + count(p.wishlist) + count(p.assigned_to_id) AS kalan_veri
FROM santa_groups g LEFT JOIN participants p ON p.group_id = g.id
GROUP BY g.id ORDER BY g.id;"
```

Anonimleştirilmiş bir grubun `silinme_tarihi` alanında bir tarih vardır ve `kalan_veri = 0` olur.

## Sayfa görüntülemeleri

Uygulama bir ziyaret sayacı tutmaz. Tek kaynak gunicorn'un istek logudur ve bu log **`web` konteyneri her yeniden oluşturulduğunda kaybolur** (yani her güncellemede). Son başlatmadan bu yana açılan sayfalar; Docker'ın otomatik sağlık kontrolü (her 30 saniyede bir), API çağrıları ve statik dosyalar hariç:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --no-log-prefix web \
  | grep -E '"GET /[^ ]* HTTP' \
  | grep -vE '^127\.0\.0\.1 |Python-urllib' \
  | grep -vE '"GET /(api|assets)/|\.(js|css|png|jpe?g|webp|svg|ico|woff2?|map|txt|json)[ ?]' \
  | wc -l
```

- 10 dakika önceki sayı için `logs` sözcüğünden sonra `--until 10m`, yalnızca son bir saat için `--since 1h` ekleyin.
- Sayfa başına sayım için `wc -l` yerine `grep -oE '"GET /[^ ?/]*' | sort | uniq -c | sort -rn` yazın.
- Bunlar kişi değil, sayfa açılışlarıdır: her yenileme sayılır ve botlar da dahildir.

## Uygulama şifresi (App Password)

Gmail ve Yahoo, hesabın normal şifresiyle e-posta gönderilmesine izin vermez; yalnızca ayrı bir **uygulama şifresiyle** gönderilebilir. Her biri için adımlar, grup oluşturma formunda "E-posta göndermek için şifreyi nasıl alırım?" altında görünür. Kısaca:

- **Gmail:** iki adımlı doğrulamayı açın, ardından şifreyi [Uygulama şifreleri](https://support.google.com/accounts/answer/185833?hl=tr) sayfasında oluşturun.
- **Yahoo:** Hesap Güvenliği → [Uygulama şifresi oluştur](https://help.yahoo.com/kb/SLN15241.html).

Şifre şifrelenmiş olarak saklanır ve tüm e-postalar gönderildikten sonra otomatik olarak silinir.

## Testler

```bash
.venv/Scripts/python -m unittest discover -s security_tests -p "test_*.py"
```

Güvenlik ve dayanıklılık denetimleri (Postgres'in çalışıyor olması gerekir):

```bash
.venv/Scripts/python security_tests/audit.py
.venv/Scripts/python security_tests/audit_robustness.py
```

## Proje yapısı

```
app/                 Flask backend: rotalar, modeller, doğrulamalar
app/advent.py        advent takvimi: hangi günün açık olduğu, film rotaları
app/services/        e-posta gönderimi, çekiliş, kişisel verilerin silinmesi
email_worker.py      kuyruktaki e-postaları gönderen süreç
advent_import.py     takvim filmlerini veritabanına aktarır
start.py             sunucuyu ve e-posta sürecini Docker'da başlatır
frontend/            React uygulaması (sayfalar, bileşenler, temalar, çeviriler)
movies/              takvimin filmleri ve afişleri (git'te değil)
security_tests/      birim testleri ve güvenlik denetimleri
```
