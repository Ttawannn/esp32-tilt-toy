# เผยแพร่เว็บแฟลชผ่าน GitHub Pages

เว็บเป็น static HTML/CSS/JS และ firmware binaries จึงใช้ GitHub Pages ได้ โดยไม่มี backend บน GitHub การตั้งค่ามือถือยังให้บริการจาก ESP32 ผ่าน Wi-Fi AP

## ค่าใช้จ่ายและการมองเห็น

GitHub Pages ใช้กับ public repository ได้ใน GitHub Free ส่วน private repository ต้องมีแพ็กเกจที่รองรับ เว็บไซต์ Pages ตามการตั้งค่าทั่วไปเปิดให้คนทั่วไปเข้าชมได้แม้ source repo เป็น private ตรวจนโยบายและโควตาก่อนเผยแพร่ [Creating a Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

โดเมน `github.io` มี HTTPS ซึ่งจำเป็นสำหรับ Web Serial ผู้ใช้ยังแฟลชผ่าน Chrome/Edge บนคอมพิวเตอร์และเลือกพอร์ตเองตามขั้นตอนเดิม [HTTPS on Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

## ขั้นตอนเผยแพร่

1. สร้างหรือเลือก repository `esp32-tilt-toy` ในบัญชี GitHub ที่ต้องการ
2. Push source จาก `main` รวม `web/firmware/*.bin` และ manifests ที่ตรวจแล้ว
3. เปิด **Settings → Pages → Build and deployment → Source → GitHub Actions**
4. รัน workflow **Deploy web installer to GitHub Pages** หรือ push เข้า `main`
5. เมื่อ deploy สำเร็จ เปิด URL ที่ workflow คืนให้ รูปแบบทั่วไปคือ `https://<owner>.github.io/esp32-tilt-toy/`

Workflow ใน `.github/workflows/pages.yml` ใช้ `npm ci`, `npm test`, `npm run build` แล้วเผยแพร่เฉพาะ `dist/` รวม binary ทั้ง 6 โปรไฟล์ (รวม Mini TFT แนวตั้งและแนวนอน) ไม่ต้อง compile Arduino ระหว่าง deploy เว็บ เนื่องจากมี release artifacts ที่ตรวจแล้วใน Git

ไฟล์เว็บและ manifest ใช้ relative URLs รองรับ path ของ project site เช่น `/esp32-tilt-toy/` โดยไม่ต้องแก้ชื่อบัญชีใน source เมื่อแก้ firmware ให้ build releases, ตรวจ tests และ commit binaries/manifests ให้ตรงกับ source ก่อน push

ผูกกับ GitHub Pages ได้โดยไม่ต้องลบ `.openai/hosting.json` หากยังเก็บการเผยแพร่ผ่าน Sites ไว้ ส่วนไฟล์นั้นไม่ถูกส่งไปใน artifact ของ Pages

## ตรวจหลังเผยแพร่

- เลือกจอครบ 6 โปรไฟล์ รวม Mini TFT ทั้งสองแนว แล้ว checksum ผ่านและ download `.bin` ได้
- เปิดจาก Chrome/Edge และกดเชื่อมต่อจนเห็นหน้าต่างเลือกพอร์ต
- ตรวจหน้า mobile และข้อความ browser ที่ไม่รองรับ Web Serial
- ทดลองแฟลชกับ C6 และจอจริงตาม `PLAN.md` ระยะ D ก่อนยืนยัน hardware compatibility

ข้อจำกัดของบริการดู [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
