# ClipKit — Entry Workspace Redesign Scope

สถานะ: Architecture approved — awaiting written-spec review  
วันที่: 28 สิงหาคม 2026  
ขอบเขตเอกสาร: **Data foundation → URL Intelligence → Entry workspace** ตามลำดับ ยังไม่รวมการแก้ Image Editor/PDF Preview ตาม Scope รอบก่อน

## 1. เป้าหมายของหน้า

### ผู้ใช้หลัก

ทีม PR/Clipping ที่ต้องบันทึกข่าวจำนวนมากต่อเนื่อง โดยข้อมูลต้องถูกต้องพอสำหรับสร้าง Excel, Mail Merge และ PDF ในขั้นถัดไป

### งานหลักเพียงหนึ่งเดียว

เปลี่ยน URL ข่าวหนึ่งรายการให้เป็น **Clipping record ที่ตรวจสอบแล้วและพร้อมเข้าสู่คิวงาน** โดยผู้ใช้ต้องมองเห็นทันทีว่า:

- ระบบตรวจพบสื่อและ Platform ใด
- ใช้ PR Value และโลโก้ใด
- ไฟล์จะถูกตั้งชื่ออย่างไร
- ยังขาดข้อมูลอะไร
- เมื่อกดบันทึก รายการจะเข้าสถานะใด

### ผลลัพธ์ที่ต้องการ

- ลดการเลื่อนและการสลับเปิด/ปิดส่วนย่อยระหว่างกรอกข่าว
- ลดช่องข้อมูลซ้ำและลดความสับสนระหว่างค่า Auto กับ Manual
- ให้กรอกข่าวทั่วไปได้จบจากบนลงล่างโดยไม่ต้องเข้า Media DB
- ทำให้ข้อผิดพลาดเรื่อง Platform, โลโก้, PR Value และชื่อไฟล์เห็นก่อนบันทึก
- รักษา Logic และข้อมูลเดิมไว้ ไม่ทำ Migration ที่เสี่ยงโดยไม่จำเป็น

## 2. Audit หน้าปัจจุบัน

### 2.1 ลำดับความสำคัญของข้อมูล

1. ฟอร์มไม่มีหัวเรื่องหรือบริบทของโปรเจกต์ภายในแผง ผู้ใช้ต้องย้อนมอง Project selector บน Topbar
2. `ข้อมูลข่าว`, `ผลลัพธ์อัตโนมัติ`, `Manual Override` และ `รายละเอียด` มีน้ำหนักใกล้เคียงกัน ทั้งที่ไม่ได้สำคัญเท่ากัน
3. PR Value ถูกทำเป็นการ์ดสีเด่นที่สุด แต่การเลือกสื่อ, Platform และโลโก้ซึ่งเป็นตัวกำหนดความถูกต้องกลับมีน้ำหนักน้อยกว่า
4. File name และ Logo แยกเป็นกล่องคนละรูปแบบ ทำให้ผู้ใช้ต้องประกอบภาพผลลัพธ์เอง
5. ฟอร์ม Manual ซ้ำ Publication, Platform, PR Value และ Link กับฟอร์มหลัก เกิดแหล่งข้อมูลสองชุดในหน้าจอเดียว
6. Type, Work status, Headline และ Remark แทรกอยู่ในเส้นทางหลัก แม้หลายรายการไม่จำเป็นต้องแก้

### 2.2 Layout และพื้นที่ใช้งาน

1. Desktop ใช้สามคอลัมน์คงที่: ฟอร์ม 380 px, ตาราง และ Quick DB 240 px ทำให้ทั้งฟอร์มและตารางถูกบีบพร้อมกัน
2. ฟอร์มยาวและเลื่อนอยู่ภายใน Card ขณะที่ปุ่มบันทึกถูกตรึงด้านล่าง จึงมองไม่เห็นความสัมพันธ์ระหว่าง Error กับช่องที่ต้องแก้
3. Quick DB แสดงตลอดเวลา แม้เป็นงานที่ใช้เป็นครั้งคราว และซ้ำกับแท็บฐานข้อมูล/Logo Manager
4. Topbar รวม Brand, Navigation, Project, Settings, Sync, Overwrite และ Export ไว้ระดับเดียวกัน ทำให้ Primary action ของหน้าหายไปในกลุ่มคำสั่ง
5. Breakpoint ต่ำกว่า 960 px เปลี่ยนทุกคอลัมน์เป็นกองแนวตั้ง ส่งผลให้ผู้ใช้ต้องเลื่อนผ่านทั้งฟอร์ม ตาราง และ Quick DB ที่ยาวมาก

### 2.3 Interaction

1. กด Enter ใน Input ส่วนใหญ่แล้วเพิ่มรายการทันที เสี่ยงบันทึกก่อนเลือก Autocomplete หรือก่อนตรวจค่าครบ
2. PR Card ทั้งใบคลิกได้แต่ไม่เป็นปุ่มตาม Semantic และไม่บอกจุดที่จะแก้ชัดเจน
3. Logo มีทั้งกล่องคลิก, ปุ่มเพิ่ม/เปลี่ยน และฟอร์มค้นหาแบบซ่อน เป็น Interaction สามชั้นสำหรับงานเดียว
4. Platform มีตัวเลือก “เพิ่ม/จัดการ” ปะปนกับค่าข้อมูลจริงใน Select
5. Validation อยู่เหนือปุ่มบันทึก ไม่ได้ผูกกับช่องที่มีปัญหา และสามารถปิดข้อความโดยที่ปัญหายังอยู่
6. Auto-fill ไม่มีสถานะที่สม่ำเสมอว่าแต่ละค่าได้จาก URL, Media DB, Project default หรือผู้ใช้แก้เอง
7. ช่อง Platform เป็นข้อมูลบังคับใน Logic แต่ Label ยังไม่แสดงเครื่องหมายบังคับ

### 2.4 Visual language

1. Indigo gradient, Card เงานุ่ม, Pill badge และ Emoji หลายจุดทำให้หน้าตาคล้าย Admin template ทั่วไปมากกว่าระบบงาน Clipping
2. มีทั้ง DM Sans, General Sans, Mono และ Font fallback ภาษาไทย ซึ่งอาจทำให้น้ำหนัก/ความสูงบรรทัดภาษาไทยไม่ต่อเนื่อง
3. ใช้ตัวพิมพ์ใหญ่ภาษาอังกฤษและ Tracking กว้างในหลาย Label แม้เนื้อหาหลักเป็นภาษาไทย
4. สีเขียว น้ำเงิน เหลือง แดง ถูกใช้ทั้งเป็น Brand และ Status โดยไม่มีกฎความหมายที่ชัดเจน
5. Inline style จำนวนมากทำให้ Spacing, Radius และ Control height ไม่เป็นระบบเดียวกัน

### 2.5 Accessibility และความทนทาน

1. Label หลายจุดเป็น `div` ไม่ได้เชื่อมกับ Input ด้วย `label/for`
2. Element ที่คลิกได้บางจุดเป็น `div` ทำให้ใช้ Keyboard และ Screen reader ได้ไม่ครบ
3. Error และสถานะบางอย่างพึ่งสี/Emoji
4. Control หลายจุดสูงต่ำกว่าเป้าหมายสัมผัส 40–44 px
5. Focus state และคำอธิบายปุ่ม Icon ยังไม่สม่ำเสมอ

## 3. ทิศทางการออกแบบ: “Clipping Desk”

หน้าจอจะมีบุคลิกแบบ **โต๊ะตรวจปรู๊ฟของทีมข่าว**: แม่นยำ เป็นเครื่องมือ และสงบพอสำหรับทำงานซ้ำจำนวนมาก แต่ไม่เลียนแบบหน้าหนังสือพิมพ์หรือ Dashboard สำเร็จรูป

### Signature element — Verification Rail

แถบแนวตั้งข้างฟอร์มแสดงสถานะของลำดับงานจริง:

1. Source — ลิงก์และวันที่
2. Match — สื่อและ Platform
3. Proof — PR Value, Logo และชื่อไฟล์
4. Queue — สถานะงานและการบันทึก

Rail ไม่ได้มีไว้ตกแต่ง แต่เปลี่ยนสถานะตามข้อมูลจริง:

- ว่าง: สีเทา
- กำลังตรวจ: สีน้ำเงิน
- พร้อม: สีเขียวอมฟ้า
- ต้องแก้: สีส้ม/แดง พร้อมข้อความ

### Color tokens

| Token | Hex | หน้าที่ |
|---|---:|---|
| Ink | `#17242D` | ข้อความหลักและปุ่ม Primary |
| Newsroom | `#F2F5F4` | พื้นหลัง Workspace |
| Sheet | `#FFFFFF` | พื้นผิวฟอร์มและตาราง |
| Proof Teal | `#087D75` | สถานะพร้อม, Focus และ Brand accent |
| Registrar Blue | `#3157D5` | ค่า Auto/ข้อมูลที่ระบบตรวจพบ |
| Markup Amber | `#C66A18` | Warning และค่าที่ผู้ใช้ Override |
| Error Red | `#BD3C45` | Error ที่บล็อกการบันทึก |

หลักการ: ใช้ **Ink + Proof Teal** เป็นภาพจำหลัก ส่วน Blue/Amber/Red ใช้ตามความหมายเท่านั้น ไม่ใช้ Gradient กับปุ่มหลัก

### Typography

- UI ภาษาไทยและหัวข้อ: `IBM Plex Sans Thai`, น้ำหนัก 400/500/600
- ตัวเลข, URL, Filename และ metadata: `IBM Plex Mono`, น้ำหนัก 400/500
- หลีกเลี่ยงน้ำหนัก 700–800 ใน Body และ Label
- ใช้ตัวพิมพ์ใหญ่เฉพาะรหัสสั้น เช่น `URL`, `PR VALUE`, `PDF`
- Body 14–15 px, Label 12–13 px, Page title 22–24 px, Data emphasis 18–22 px

เหตุผล: IBM Plex ให้บุคลิกแบบเครื่องมือบรรณาธิการและรองรับข้อมูลเชิงเทคนิค ขณะที่ภาษาไทยยังอ่านได้ชัดเจนกว่าการตกลง Font fallback โดยไม่ตั้งใจ

### Shape และพื้นผิว

- Radius หลัก 8 px; Card ใหญ่ 10–12 px; Pill ใช้เฉพาะสถานะจริง
- ลดเงา Card ใช้เส้นแบ่งและพื้นผิวต่างระดับแทน
- เส้นกรอบ 1 px; Focus ring 3 px ที่เห็นชัด
- Icon ใช้ SVG ชุดเดียว ไม่ใช้ Emoji เป็น Navigation หลัก
- Motion เฉพาะตอน URL ถูกวิเคราะห์: Verification Rail เคลื่อนสถานะ 180–220 ms และเคารพ `prefers-reduced-motion`

## 4. Information Architecture ใหม่

### Desktop ≥ 1280 px

```text
┌────────────────────────────────────────────────────────────────────┐
│ ClipKit / Project             กรอกข่าว  ฐานข้อมูล       Export     │
├────────────────────────────────────────────────────────────────────┤
│ ┌─ Entry sheet 460–500 px ─┐  ┌─ Coverage queue ─────────────────┐ │
│ │ Project + progress         │  │ Search / filters / Batch PDF    │ │
│ │ │ Source                   │  │                                 │ │
│ │ │ Match                    │  │ Existing clipping records       │ │
│ │ │ Proof card               │  │                                 │ │
│ │ │ Workflow                 │  │                                 │ │
│ │ Sticky validation/actions  │  │ Summary strip                   │ │
│ └────────────────────────────┘  └─────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

- ยกเลิก Quick DB คอลัมน์ถาวร
- เปิด Media/Platform form กลางผ่าน Drawer/Modal จากช่อง Publication หรือ Platform
- ตารางรายการคงอยู่ข้างฟอร์มเพื่อยืนยันว่ารายการถูกเพิ่มแล้ว
- Form กว้างขึ้นเป็น 460–500 px เพื่อรองรับภาษาไทยและ Logo preview โดยไม่บีบ

### Tablet 768–1279 px

- Form 420–460 px และ Queue ใช้พื้นที่ที่เหลือ
- Toolbar ตารางยุบ Filter รองเป็น Popover
- ซ่อนคอลัมน์ URL/Logo/Filename จากตารางโดยอัตโนมัติ แต่เปิดดูจาก Row detail ได้

### Mobile < 768 px

- ใช้ Segmented navigation `กรอกข่าว | รายการ` ไม่กองฟอร์มและตารางต่อกัน
- ฟอร์มหนึ่งคอลัมน์เต็มความกว้าง
- ปุ่ม `เพิ่มเข้าคิว` ตรึงด้านล่างพร้อมสถานะความพร้อม
- Modal เพิ่มสื่อ/Platform เปลี่ยนเป็น Full-screen sheet

## 5. โครงสร้างฟอร์มใหม่

### A. Form header

- ชื่อหน้า: `เพิ่มข่าวเข้าโปรเจกต์`
- แสดงชื่อโปรเจกต์และจำนวนรายการวันนี้
- แสดง `บันทึกร่างในเครื่องแล้ว` เมื่อมี Draft
- Project selector หลักยังอยู่ Topbar แต่ภายในฟอร์มต้องเห็น Context ปัจจุบัน

### B. Source

1. URL เป็นช่องแรกและเด่นที่สุด พร้อมปุ่ม Paste
2. วันที่เผยแพร่อยู่แถวเดียวกับสถานะตรวจ URL
3. เมื่อวาง URL ให้แสดงข้อความเฉพาะเจาะจง เช่น `ตรวจพบ Instagram · @commocommu`
4. URL ซ้ำแสดง Inline error และลิงก์ `เปิดรายการเดิม`
5. ไม่บันทึกด้วย Enter ธรรมดา เปลี่ยนเป็น `Cmd/Ctrl + Enter`

### C. Media match

- Publication และ Platform เป็น Required ทั้งคู่
- Publication autocomplete แสดง Logo thumbnail, ชื่อสื่อ, Platform ที่มี และ PR Value
- หากไม่พบสื่อ แสดง Empty action `เพิ่ม “ชื่อสื่อ” ลง Media DB`
- ปุ่มจัดการ Platform แยกจาก Option ข้อมูลจริง
- TV แสดง Duration หลังเลือก Platform เท่านั้น
- ทุกค่าที่ระบบเติมมี Source badge: `จาก URL`, `Media DB`, `ค่าโปรเจกต์` หรือ `แก้เอง`
- ผู้ใช้กด `คืนค่าอัตโนมัติ` ได้รายช่อง

### D. Output proof card

รวมผลลัพธ์ที่ปัจจุบันกระจายอยู่สามกล่องให้เป็น Proof card เดียว:

```text
┌──────────────────────────────────────────┐
│ ผลลัพธ์ที่จะใช้                          │
│ [Logo] Publication — IG         พร้อม ✓  │
│ PR VALUE                    ฿150,000     │
│ 260806_Publication - IG.pdf              │
│ [เปลี่ยนโลโก้] [แก้ PR] [คัดลอกชื่อไฟล์] │
└──────────────────────────────────────────┘
```

- แสดง Logo จริง ไม่แสดงเพียงชื่อไฟล์
- ใช้โลโก้ล่าสุดของ Media + Platform เป็น Default ตาม Logic เดิม
- หากไม่มีโลโก้ Card เปลี่ยนเป็นสถานะ Blocked พร้อมปุ่ม `เพิ่มโลโก้`
- การแก้ PR และ Logo ใช้ปุ่มที่มีชื่อชัดเจน ไม่ทำให้ Card ทั้งใบคลิกได้
- ลบ Manual Override form ที่ซ้ำช่องหลัก เปลี่ยนเป็นแก้ Inline ใน Proof card
- ค่า Override แสดงด้วย Markup Amber และมี `คืนค่าจาก DB`

### E. Workflow details

- Type ตรวจจาก Platform อัตโนมัติและแสดงเป็นค่ารอง
- Work status ใช้ภาษาไทยเป็นชื่อหลัก พร้อมคำอธิบายสั้น
- Headline/Remark อยู่ใน `รายละเอียดเพิ่มเติม` ซึ่งปิดไว้เป็นค่าเริ่มต้น
- ไม่ใช้เลขขั้นกับรายละเอียดที่ไม่ใช่ขั้นตอนบังคับ

### F. Sticky action bar

- Primary: `เพิ่มเข้าคิว` พร้อม Shortcut `Cmd/Ctrl + Enter`
- Secondary: `บันทึกและเปิด Capture` เมื่อข้อมูลพร้อม
- Tertiary: `ล้างแบบฟอร์ม`
- แสดงข้อความสรุป เช่น `พร้อมบันทึก` หรือ `ยังขาด Platform และโลโก้`
- Error บล็อก Primary; Warning อนุญาตให้บันทึกหลังยืนยัน

## 6. Validation และ State model

### Field states

- Default
- Focus
- Auto-filled
- User-edited
- Warning
- Error
- Disabled/Unavailable

### กฎ

1. Error แสดงใต้ช่องที่เกี่ยวข้องและรวมใน Sticky action bar
2. ข้อความ Validation ห้ามปิดทิ้งโดยที่ปัญหายังอยู่
3. Publication, Platform และ Date เป็นข้อมูลบังคับสำหรับ Record
4. URL ไม่บังคับ แต่ถ้ามีต้องเป็น HTTP/HTTPS ที่ถูกต้อง
5. ไม่มี Logo ยังบันทึก Draft ได้ แต่ปิดคำสั่งไปขั้น Export/PDF ตามกติกาเดิม
6. ไม่พบ PR Value ให้ผู้ใช้เพิ่มหรือ Override ก่อนตั้งสถานะ Ready
7. Duplicate URL ต้องแสดงรายการเดิมและให้ยืนยันการเพิ่มซ้ำอย่างชัดเจน
8. เมื่อผู้ใช้แก้ค่าที่ระบบเติม Badge ต้องเปลี่ยนเป็น `แก้เอง`; Reset จะย้อนกลับแหล่งเดิม

## 7. Topbar และ Queue

### Topbar

- ฝั่งซ้าย: Brand, Navigation
- กลาง: Project selector ซึ่งเห็นชื่อเต็มและสถานะ Local/Connected
- ฝั่งขวา: Search command, Settings และปุ่ม Export เดียว
- ย้าย Sync/Overwrite เข้า Export menu หรือ Settings ตามบริบท
- ไม่แสดงปุ่ม Excel ซ้ำทั้ง Topbar และ Table toolbar

### Coverage queue

- Toolbar แถวแรก: Search, Platform, Status, Date
- Toolbar แถวสองเปิดเฉพาะเมื่อเลือกรายการ: จำนวนที่เลือก, Batch PDF และคำสั่งชุด
- Column settings อยู่ในเมนู View
- `ล้างทั้งหมด` ย้ายเข้าเมนู More และใช้ข้อความระบุโปรเจกต์ที่จะถูกล้าง
- Empty state ชี้นำให้วาง URL ในฟอร์ม ไม่ใช้เพียงตารางว่าง

## 8. Component scope

### สร้าง/ปรับ Component

- App header
- Project context
- Verification rail
- URL source field
- Media autocomplete result
- Source badge
- Output proof card
- Logo picker trigger/state
- Inline editable PR value
- Field message
- Sticky action bar
- Queue toolbar และ selection toolbar
- Responsive mobile navigation
- Shared Add/Edit Media dialog trigger

### นำ Component เดิมกลับมาใช้

- Media DB/Logo Manager logic
- Platform Registry logic
- Project selector logic
- URL parser และ Username mapping
- Filename builder
- PR lookup
- Duplicate detection
- Work status values

## 9. Accessibility requirements

- Input ทุกตัวมี `label` ที่เชื่อมด้วย `for/id`
- Interactive element ใช้ `button`, `input`, `select` ตาม Semantic
- Touch target ขั้นต่ำ 44 × 44 px บน Mobile และ 40 px บน Desktop
- Keyboard สามารถเข้าถึง Autocomplete, Drawer, Proof actions และ Queue ได้ครบ
- Focus ring เห็นชัดและไม่ถูกตัดโดย Container
- Validation summary ใช้ `aria-live="polite"`; Error ผูกกับ Field ผ่าน `aria-describedby`
- Status ไม่ใช้สีเพียงอย่างเดียว ต้องมี Icon/ข้อความ
- Contrast ผ่าน WCAG AA
- รองรับ `prefers-reduced-motion`

## 10. Architecture decision

เลือก **IndexedDB Offline-first** เป็น Source of truth ของ ClipKit และใช้ `localStorage` เฉพาะค่าหน้าจอ เช่น Project ล่าสุด, Filter, Panel width และ UI preferences

Record และ Asset ใหม่ใช้ UUID ที่สร้างด้วย `crypto.randomUUID()`; Migration เก็บตาราง Old ID → New ID เพื่อรักษา Reference และรองรับการทำซ้ำโดยไม่สร้างข้อมูลซ้ำ

เหตุผลที่ไม่ต่อเติม Object ใน `localStorage`:

- ข่าว, Capture, Logo, Resolver metadata และ Audit history โตเกินรูปแบบ Key/value ได้ง่าย
- การเพิ่มข่าวใหม่อาจต้องสร้าง Media, Mapping, Provenance และ Asset พร้อมกัน ซึ่งต้องใช้ Transaction
- Backup, Restore, Revision conflict และ Reference integrity ต้องมี Data access layer ที่ชัดเจน
- IndexedDB ยังรักษาเงื่อนไข Offline-first และการ Deploy บน GitHub Pages

ยังไม่เพิ่ม Cloud database หรือระบบ Login ในขอบเขตนี้ Google Sheets เป็น Controlled sync/ปลายทาง Export ไม่ใช่ Source of truth

## 11. IndexedDB data model

### 11.1 Project

```text
id, name, clientName, settings, resolverConfigRef,
createdAt, updatedAt, deletedAt, recordVersion
```

- Default project ห้ามลบ
- Project override มีสิทธิ์แทน System default
- Directory handle และ Secret ไม่อยู่ใน Backup

### 11.2 Entry

```text
id, projectId, publicationId, publicationDisplayOverride,
platformId, publishedDate, publishedAtRaw, publishedTimezone,
urlOriginal, urlCanonical, urlDisplay, urlFingerprint,
platformContentId, prValueSnapshot, prSource,
duration, headline, remark, workflowStatus,
logoLockAssetId, exportOrder,
createdAt, updatedAt, deletedAt, recordVersion
```

- ID ไม่ขึ้นกับชื่อสื่อหรือ Platform
- URL และวันที่ที่ผู้ใช้ยืนยันแล้วห้าม Resolver เขียนทับ
- PR Value เป็น Snapshot ตอนเพิ่มข่าว มีคำสั่งอัปเดตตาม DB ล่าสุดแบบต้องยืนยัน
- Filename เป็น Derived value ไม่เป็น Source of truth

### 11.3 Media registry

แยก Store ตามหน้าที่:

- `media`
- `mediaAliases`
- `domainMappings`
- `usernameMappings`
- `platforms`
- `mediaPlatformMappings`
- `logoAssets`
- `logoMappings`

Entry อ้างอิง Media/Platform ด้วย ID การแก้ชื่อจึงไม่ทำให้ Reference เสีย ค่า Logo ล่าสุดเป็น Default แต่ Entry ที่ล็อก Logo ใช้ Asset เดิม

### 11.4 URL inspection และ Field provenance

URL inspection เก็บ:

```text
entryId/draftId, resolverVersion, inspectedAt,
resolvedUrl, canonicalUrl,
publicationCandidates[], dateCandidates[],
metadataSources[], confidence, warnings[]
```

Field provenance เก็บ `value`, `source`, `confidence`, `confirmedByUser`, `confirmedAt` และ `locked`

ลำดับอำนาจข้อมูล:

1. ผู้ใช้แก้และล็อก
2. Project override
3. Mapping ที่ผู้ใช้ยืนยัน
4. Resolver metadata
5. URL heuristic

ค่าระดับต่ำกว่าห้ามเขียนทับค่าระดับสูงกว่า

### 11.5 Assets, captures และ layouts

- เก็บไฟล์ต้นฉบับพร้อม Asset ID, MIME type, ขนาด และ Checksum
- Crop, Rotation, Scale, Alignment และ Page cuts เป็น Transform metadata ไม่แก้ต้นฉบับ
- Asset ขนาดใหญ่เข้าพื้นที่ Staging ก่อนผูก Reference
- Asset ที่ยังถูกอ้างอิงห้ามลบ

### 11.6 Audit events

Audit history เป็น Append-only และเก็บเฉพาะเหตุการณ์สำคัญ:

- สร้าง/แก้/ลบ/กู้คืน Entry
- เปลี่ยน Publication, Platform, Date, PR, Logo, URL หรือ Workflow status
- เพิ่ม/ลบ/ปรับ Capture
- Import, Migration, Merge และ Export

แต่ละ Event เก็บค่าก่อน, ค่าหลัง, เวลา, Revision และแหล่งการเปลี่ยน (`user`, `resolver`, `migration`, `import`) ไม่เก็บทุก Keystroke หรือ Preview

### 11.7 Export jobs

Export snapshot เป็น Immutable และเก็บ:

- Entry revision
- Publication/Platform ที่แสดง
- PR, Date และ URL ทั้งสามรูปแบบ
- Asset IDs และ Checksums
- Crop/Rotation/Scale/Alignment/Page cuts
- Template, Paper, Quality และ Layout engine version
- Filename pattern และชื่อไฟล์จริง
- Warnings ที่ผู้ใช้ยืนยัน
- สถานะสำเร็จ/ล้มเหลว/ถูกข้าม

Batch มี Parent job และ Child result แยกแต่ละข่าว `export-summary.csv` สร้างจากผล Child จริง ไม่ใช่รายการที่เลือกตอนเริ่ม

## 12. URL Intelligence

### 12.1 Processing pipeline

```text
วาง URL
→ เก็บ Original URL
→ Normalize/Clean ในเครื่อง
→ สร้าง Display URL และ Fingerprint
→ ตรวจ Domain/Username mapping
→ เรียก Metadata Resolver เมื่อเปิดใช้งาน
→ รวม Publication/Date candidates
→ จัดอันดับ Confidence
→ ให้ผู้ใช้ยืนยันเฉพาะค่าที่ไม่แน่นอน
→ สร้าง Provenance
→ Commit พร้อม Entry
```

URL parser ในเครื่องต้องทำงานได้เสมอแม้ Offline หรือยังไม่ได้ตั้ง Resolver

### 12.2 URL representations

- `Original URL`: สิ่งที่ผู้ใช้วาง เก็บเพื่ออ้างอิง
- `Canonical URL`: URL ปลายทางที่ Resolver ยืนยัน
- `Display URL`: URL อ่านง่ายสำหรับ UI, PDF และ Excel
- `URL fingerprint`: ค่า Normalize สำหรับตรวจ Duplicate
- `Platform content ID`: Post/video ID สำหรับตรวจ Social URL ที่มีหลายรูปแบบ

URL ภาษาไทยเก็บค่าต้นฉบับแบบเข้ารหัส แต่แสดง path ที่ถอดด้วย `decodeURI` ลิงก์ที่เปิดจริงยังใช้ URL ที่ Browser เข้ารหัสอย่างถูกต้อง

### 12.3 Query cleanup

ห้ามลบ Query ทั้งหมด ใช้กฎแยกตาม Domain:

- ลบ `fbclid`, `rdid`, `ref`, `refsrc`, `utm_*`, `igsh`, `mibextid` และ Fragment
- เก็บ Parameter ที่ระบุ Content เช่น `p`, `story_fbid`, `id`, `v`
- เรียง Parameter ที่เหลือให้คงที่สำหรับ Fingerprint
- ไม่ใช้บริการย่อลิงก์ภายนอก

### 12.4 Facebook permalink

Resolver พยายามเปลี่ยน `pfbid` เป็น Numeric permalink ตามลำดับ:

1. Canonical/permalink จาก Public page
2. URL จาก Public Embed metadata
3. ตรวจ Page username และ Numeric post ID
4. สร้าง `/{username}/posts/{numericId}` และลบ Tracking

ถ้าหา Numeric ID ไม่ได้ต้องเก็บ Clean `pfbid` ห้ามเดาเลข ระบบรองรับการวาง URL ปกติ, Timestamp URL และ iframe Embed code แต่ไม่เก็บ iframe HTML

ห้ามใช้ Cookie, Login session หรือ Token Facebook และห้ามควบคุม Facebook UI อัตโนมัติ หากข้อมูล Public ไม่พอให้แนะนำวิธีเปิด Embed/กด Timestamp หรือกรอกเอง

### 12.5 Publication extraction

ลำดับแหล่งข้อมูล:

1. Mapping ที่ผู้ใช้ยืนยัน
2. Canonical domain alias ใน Media DB
3. JSON-LD `publisher.name`
4. `og:site_name`
5. `application-name`
6. ชื่อที่แยกจาก Domain

ผลลัพธ์ต้องเทียบ Media DB ก่อนใช้งาน:

- Confidence สูง: เติมอัตโนมัติ
- Confidence กลาง: Candidate ให้ยืนยัน
- Confidence ต่ำ: เป็นคำแนะนำเท่านั้น

สำหรับเว็บรวมข่าว ให้ใช้สำนักข่าวต้นทางเป็น Publication และ Host รวมข่าวเป็น Platform เช่น `Marketingoops · LINE TODAY`

### 12.6 Date extraction

ลำดับแหล่งวันที่:

1. JSON-LD `NewsArticle/Article.datePublished`
2. `itemprop="datePublished"`
3. `article:published_time`
4. `<time datetime>` ในบทความ
5. Pattern ของเว็บไซต์ที่ผู้ใช้ยืนยัน
6. URL path
7. ข้อความวันที่บนหน้า ซึ่งต้องยืนยัน

- ใช้วันที่เผยแพร่ครั้งแรก ไม่ใช้ `dateModified`, Copyright หรือ Footer
- หากแหล่งมาตรฐานให้คนละวัน ต้องแสดง Candidate และหยุด Auto-fill
- Date-only ไม่แปลง Timezone; UTC timestamp แปลง `Asia/Bangkok` ก่อนแสดงและเก็บค่าต้นฉบับ
- Relative time เช่น `22 hours ago` เป็นคำแนะนำเว้นแต่มี Absolute timestamp
- เมื่อมี URL แต่อ่านวันที่ไม่ได้ให้ปล่อยว่าง
- TV กรอก Date เองเสมอและไม่เรียก Resolver เมื่อ URL ว่าง

### 12.7 Resolver boundary

แนะนำ Metadata Resolver แยกจาก Google Sheets เช่น Cloudflare Worker และให้ตั้ง Endpoint ได้

- ส่งเฉพาะ URL, Random request ID และ Rule version
- ไม่ส่ง Project, Client, PR, Logo หรือข่าวอื่น
- อนุญาตเฉพาะ HTTP/HTTPS สาธารณะ
- บล็อก localhost, Private IP, Cloud metadata address, Protocol และ Port ที่ไม่เหมาะสม
- ตรวจ Redirect ทุกครั้ง จำกัดไม่เกิน 5 ครั้ง
- จำกัด HTML ประมาณ 2 MB และ Timeout 8 วินาที
- Retry อัตโนมัติหนึ่งครั้งเฉพาะ Network error
- ไม่ข้าม Paywall, Login, CAPTCHA หรือ Private post
- ไม่ส่ง/เก็บ HTML กลับ ClipKit ส่งเฉพาะ Metadata
- Access key เก็บเฉพาะ Session และ Resolver มี Rate limit
- ยังไม่ใช้ Headless Browser ในรอบแรก

Resolver cache เก็บใน IndexedDB 7 วันตาม Canonical URL ปุ่ม `ตรวจใหม่` ข้าม Cache ส่วน Entry ที่บันทึกแล้วเก็บ Metadata snapshot ของตนเอง

## 13. Save and lifecycle rules

### 13.1 Atomic save

Save coordinator กลางต้องทำงานตามลำดับ:

1. เตรียม Draft และ Validation
2. สร้าง Media เมื่อผู้ใช้ยืนยัน
3. บันทึก Domain/Username mapping ที่ผู้ใช้เลือกให้จำ
4. บันทึก Logo asset/mapping ถ้ามี
5. สร้าง Entry และ Provenance
6. บันทึก URL inspection snapshot
7. เพิ่ม Audit event
8. Commit ทั้งชุดใน Transaction เดียว

หากขั้นตอนใดล้มเหลวต้อง Rollback ทั้งหมด ป้องกันการกด Save ซ้ำด้วย Request ID

### 13.2 Workflow status และ readiness

Workflow status ที่ผู้ใช้ควบคุม:

- Draft
- Captured
- Ready
- Completed

Readiness ที่ระบบคำนวณ:

- Required fields
- PR Value
- Logo
- Capture
- DPI/การยืนยันภาพต่ำ
- URL/Date candidates ที่ค้าง
- Template/Project assets

ไม่มี Logo หรือ PR ยังบันทึก Draft และเปิด Capture ได้ แต่ห้าม Ready/Download PDF เมื่อข้อมูลไม่ครบ รายการ Ready ที่ถูกแก้จนไม่พร้อมต้องขึ้น `Needs review` พร้อม Audit event

### 13.3 Snapshot policy

- Publication ใช้ Media name ล่าสุด โดยมี `publicationDisplayOverride`
- Platform registry ใช้ค่าล่าสุดกับงานใหม่
- PR เป็น Snapshot และไม่เปลี่ยนตาม DB อัตโนมัติ
- Logo ใช้ล่าสุดจนกว่า Entry จะล็อก Asset
- URL/Date ที่ยืนยันแล้วรักษาค่าเดิม
- Export snapshot ไม่เปลี่ยนตามฐานข้อมูลภายหลัง

### 13.4 Trash และ retention

- Entry และ Project ใช้ Soft delete 30 วัน
- Capture, Metadata และ History อยู่ครบระหว่างกู้คืน
- Shared Media/Platform/Logo ไม่ถูกลบตาม Project
- ลบถาวรได้หลังแสดงจำนวนไฟล์และพื้นที่ พร้อมเสนอ Backup
- Asset ที่ไม่มี Reference จึงถูกลบได้
- Directory handle ถูกนำออกเมื่อ Project ถูกลบ แต่ไม่ลบไฟล์ปลายทาง

### 13.5 Multi-tab concurrency

- ทุก Entry มี `recordVersion`
- ใช้ `BroadcastChannel` แจ้งการเปลี่ยนระหว่างแท็บ
- ตรวจ Revision ก่อน Save
- Conflict แสดงค่าล่าสุดกับค่าที่กำลังแก้และให้เลือกทีละช่องได้
- Capture/Export ใช้ Lock ชั่วคราวที่หมดอายุได้

## 14. Query, ordering and duplicate rules

IndexedDB เตรียม Index สำหรับ:

- `projectId + publishedDate`
- `projectId + status`
- `projectId + platformId`
- `projectId + publicationId`
- `urlFingerprint`
- `platformContentId`
- `updatedAt`
- `deletedAt`
- `exportBatchId`

Queue เริ่มจากวันที่เผยแพร่ล่าสุดก่อน แล้วเรียงตามลำดับที่เพิ่ม `exportOrder` แยกจาก Queue order และ Batch Export ใช้ Snapshot ของ Entry IDs + ลำดับ ณ เวลากดสร้าง

URL แบบ Original, Canonical, Embed, `pfbid`, Numeric permalink และ Tracking variants ต้องถูกมองเป็นข่าวเดียวกันเมื่อ Canonical URL หรือ Platform content ID ตรงกัน

Media duplicate ห้าม Merge อัตโนมัติ ให้ผู้ใช้เลือก Record หลัก เปลี่ยนชื่อ/Domain อื่นเป็น Alias ย้าย Reference ใน Transaction เดียว เก็บ ID เดิมเป็น Redirect และรักษา Logo ทุกไฟล์

## 15. Backup, restore and migration

### 15.1 ZIP structure

```text
manifest.json
database/
  projects.json
  entries.json
  media.json
  mappings.json
  metadata.json
  audit-events.json
  export-history.json
assets/
  logos/
  captures/
checksums.json
```

Backup ระบุ Schema/App version, จำนวน Record/Asset และ Checksum ตั้งรหัสผ่านได้ แต่ ClipKit ไม่เก็บรหัสผ่าน

### 15.2 Restore

- Import เข้าพื้นที่ชั่วคราวก่อน
- ตรวจ Schema, Checksums, References, ID collision และพื้นที่ว่าง
- เลือก Merge, สร้าง Project ใหม่ หรือแทนที่ทั้งหมด
- การแทนที่ต้องสร้าง Safety backup ก่อน
- ล้มเหลวแล้ว Rollback ทั้งชุด
- Conflict แสดง Local/Imported ทีละช่อง
- Asset ตัดสินด้วย ID + Checksum ไม่ใช่ชื่อไฟล์

### 15.3 Migration from localStorage

- สร้าง Safety snapshot ก่อนเริ่ม
- ตรวจพื้นที่และจำนวนข้อมูล
- ย้ายเป็น Batch พร้อม Progress
- เก็บ Old ID → New ID mapping
- ตรวจจำนวน, References และ Checksums
- Migration ต้อง Idempotent
- ล้มเหลวแล้ว Rollback IndexedDB ใหม่และใช้ข้อมูลเดิม
- เก็บข้อมูลเดิม Read-only 30 วันพร้อมปุ่ม Export/ย้อนกลับ
- แจ้งก่อนลบ Safety snapshot

## 16. Storage management and integrity

- ขอ Persistent storage หลังเพิ่ม Capture ครั้งแรก
- แสดงพื้นที่ใช้แยก Capture, Logo, Metadata cache, Safety snapshot และข้อมูลทั่วไป
- เตือนที่ 70% และเตือนระดับสูงที่ 85%
- เก็บกวาดอัตโนมัติเฉพาะ Cache หมดอายุ, Orphan staging และ Draft recovery หมดอายุ
- ห้ามลบ Capture/Logo/Audit/Export snapshot ที่มี Reference อัตโนมัติ
- ก่อนลบจำนวนมากเสนอ ZIP Backup

ตรวจเบาเมื่อเปิดแอป: Schema, Migration ค้าง, Staging ค้าง, Recent references และ Storage pressure

Deep audit เมื่อผู้ใช้สั่งหรือก่อน Backup/Restore สำคัญ: Missing references, Checksum, Duplicate fingerprint/content ID, Mapping collision, Export asset integrity, Audit chain และ Orphan assets

## 17. Google Sheets boundary

- IndexedDB เป็น Source of truth
- Append ส่งเฉพาะ Revision ที่ยังไม่เคยส่ง
- Update แสดง Diff และใช้รายการที่ผู้ใช้เลือก
- Overwrite อยู่ใน Advanced menu และ Backup ก่อน
- แถวใน Sheet มี Entry ID, Revision และ Last exported at
- การแก้ใน Sheet ไม่เขียนกลับอัตโนมัติ
- Import กลับผ่าน Preview และ Conflict resolution
- Sync log ไม่เก็บ Secret หรือ Response ที่ไม่จำเป็น

## 18. Implementation boundaries

### Sub-project A — Data foundation

- IndexedDB schema, repository และ transaction layer
- Compatibility adapter ให้ UI เดิมยังใช้ข้อมูลได้
- Migration, Revision, Audit, Trash และ Storage manager
- Backup/Restore รุ่นใหม่
- Regression และ Rollback tests

### Sub-project B — URL Intelligence

- URL representations, cleanup, fingerprint และ Duplicate detection
- Resolver client/configuration/cache
- Publication/Date candidates และ Provenance
- Facebook permalink/Embed parsing
- Resolver service implementation/deployment เป็น Deliverable แยก

### Sub-project C — Entry workspace redesign

- Clipping Desk tokens และ Typography
- Entry sheet + Coverage queue
- Verification Rail, Candidate panels และ Proof card
- Shared Media form, Inline validation และ Keyboard flow
- Responsive/Accessibility/Visual QA

แต่ละ Sub-project ต้องผ่าน Regression test และสามารถย้อนกลับได้ก่อนเริ่มส่วนถัดไป

### Out of scope

- PDF pagination และ Image Editor ตาม Scope รอบก่อน
- Print template rules
- Login และ Multi-user Cloud database
- Headless browser สำหรับ Resolver
- การข้าม Paywall/Login/CAPTCHA
- การควบคุม Facebook UI หรือใช้ Session/Cookie ของผู้ใช้
- URL shortener ภายนอก
- การเปลี่ยนสูตร PR Value

## 19. Acceptance criteria

### Data foundation

1. ข้อมูลเดิมย้ายจาก localStorage โดยจำนวน/Reference ครบและ Rollback ได้
2. Save ที่สร้าง Entry + Media + Mapping + Provenance ล้มเหลวแล้วไม่เหลือข้อมูลครึ่งชุด
3. เปิดหลายแท็บแล้วตรวจ Revision conflict ได้
4. Trash/Restore ของ Entry และ Project รักษา Asset/History ถูกต้อง
5. ZIP Backup ตรวจ Schema/Checksum/Reference ก่อน Restore และ Rollback ได้
6. Storage manager ไม่ลบ Asset ที่มี Reference
7. Audit แยกเหตุการณ์ user/resolver/migration/import ได้
8. Export snapshot สร้างไฟล์ซ้ำจาก Revision เดิมได้เมื่อ Asset ครบ

### URL Intelligence

9. URL ภาษาไทยแสดงอ่านง่ายแต่เปิดลิงก์จริงได้
10. Tracking ถูกลบโดยไม่ลบ Content parameter
11. Original URL ไม่สูญหายเมื่อ Canonical/Display เปลี่ยน
12. Facebook Numeric permalink ถูกใช้เฉพาะเมื่อ Resolver ยืนยัน
13. URL variants ของโพสต์เดียวกันถูกตรวจ Duplicate ได้
14. Publication/Date แสดง Source และ Confidence
15. Candidate ขัดแย้งไม่ถูก Auto-fill โดยไม่ยืนยัน
16. TV Date เป็น Manual เสมอ
17. Resolver timeout/offline ไม่บล็อกการกรอก Draft
18. Resolver ไม่รับ Private address และไม่ส่ง HTML/Cookie/Secret กลับ Client

### Entry workspace

19. ผู้ใช้กรอกข่าวทั่วไปได้โดยไม่เปิด Manual section
20. Publication/Platform ที่ผู้ใช้แก้ไม่ถูก Auto-fill เขียนทับ
21. สื่อใหม่เปิด Shared Add Media form จากหน้ากรอกข่าวได้
22. Logo, PR, Filename, Date และ Display URL อยู่ใน Proof card เดียว
23. ไม่มีฟอร์ม Publication/Platform/Link ซ้ำอีกชุด
24. Enter ธรรมดาไม่บันทึก; Cmd/Ctrl + Enter เพิ่มเข้าคิว
25. Error อยู่ติด Field และ Focus ไปจุดแก้ได้
26. ไม่มี Logo/PR ยัง Draft/Capture ได้ แต่ Ready/PDF ถูกบล็อก
27. Desktop ไม่มี Quick DB ถาวร; Mobile สลับ Form/Queue ได้
28. Keyboard flow, Focus และ Contrast ผ่าน WCAG AA
29. Filename suffix, PR lookup, Logo mapping และ Export เดิมผ่าน Regression test
30. ไม่เกิด Visual regression กับ Capture workspace, PDF Preview และ Image Editor

## 20. Design review checklist

- มี Accent หลักเพียงหนึ่งจุดในแต่ละ View หรือไม่
- การใช้ Blue/Amber/Red สื่อความหมาย ไม่ได้ใช้ตกแต่งหรือไม่
- Primary action มีเพียงหนึ่งปุ่มต่อ State หรือไม่
- Label ภาษาไทยอ่านง่ายและไม่ถูกบังคับให้เป็นตัวพิมพ์ใหญ่หรือไม่
- ทุกข้อความบอกสิ่งที่ผู้ใช้ควรทำ ไม่ใช้ศัพท์โครงสร้างระบบหรือไม่
- Card ทุกใบมีหน้าที่เฉพาะ ไม่มี Card ซ้อน Card โดยไม่จำเป็นหรือไม่
- Spacing ใช้ Scale กลางชุดเดียวหรือไม่
- Empty, Loading, Error, Duplicate, Offline และ No-logo state ครบหรือไม่
- Resolver/Auto-fill แสดง Source และไม่เขียนทับค่าที่ผู้ใช้ยืนยันหรือไม่
- Data foundation ผ่าน Migration, Transaction, Backup และ Rollback criteria ก่อนเริ่ม Redesign หรือไม่
