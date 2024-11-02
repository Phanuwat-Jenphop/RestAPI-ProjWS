

const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer'); // เพิ่ม multer
const path = require('path'); // ใช้จัดการเส้นทางไฟล์
const app = express();

app.use(cors());
app.use(bodyParser.json());

// เสิร์ฟไฟล์ภาพจากโฟลเดอร์ uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dataFilePath = './data.json';

// ฟังก์ชันอ่านข้อมูลจากไฟล์ JSON (ใช้แบบ async)
async function readData() {
    try {
        const data = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return []; // ถ้าไฟล์ไม่มีหรือเกิดข้อผิดพลาด จะคืนค่าเป็น array ว่าง
    }
}

// ฟังก์ชันเขียนข้อมูลลงในไฟล์ JSON (ใช้แบบ async)
async function writeData(data) {
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
}

// กำหนดการเก็บรูปภาพในโฟลเดอร์ uploads และกำหนดชื่อไฟล์
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // เก็บรูปในโฟลเดอร์ uploads
    },
    filename: function (req, file, cb) {
        // ตั้งชื่อไฟล์เป็น timestamp + นามสกุลไฟล์
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// ตรวจสอบประเภทไฟล์ภาพเพื่อความปลอดภัย
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif)'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // จำกัดขนาดไฟล์ไม่เกิน 5MB
    fileFilter: fileFilter
});

// GET: ดึงข้อมูลจากไฟล์ JSON
app.get('/items', async (req, res) => {
    const items = await readData();
    res.json(items);
});

// GET: ดึงข้อมูลสินค้าตาม ID
app.get('/items/:id', async (req, res) => {
    const items = await readData();
    const item = items.find(item => item.id == req.params.id);
    if (item) {
        res.json(item);
    } else {
        res.status(404).json({ message: 'Item not found' });
    }
});

// POST: เพิ่มข้อมูลในไฟล์ JSON พร้อมกับการอัปโหลดไฟล์รูปภาพ
app.post('/items', upload.single('image'), async (req, res) => {
    const items = await readData();
    const newItem = {
        id: Number(req.body.id),
        name: req.body.name,
        type: req.body.type,
        price: parseFloat(req.body.price),
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null // เก็บ URL ของรูปภาพถ้ามี
    };

    // ตรวจสอบว่า ID ซ้ำหรือไม่
    const existingItem = items.find(item => item.id === newItem.id);
    if (existingItem) {
        return res.status(400).json({ message: 'ID already exists' });
    }

    items.push(newItem);
    await writeData(items);
    res.json({ message: 'Item added', items });
});

// PUT: แก้ไขข้อมูลในไฟล์ JSON พร้อมกับการอัปโหลดไฟล์รูปภาพใหม่ (ถ้ามี)
app.put('/items/:id', upload.single('image'), async (req, res) => {
    const items = await readData();
    const { id } = req.params;
    const existingItem = items.find(item => item.id == id);

    if (!existingItem) {
        return res.status(404).json({ message: 'Item not found' });
    }

    // อัปเดตข้อมูลที่เจอ
    existingItem.name = req.body.name || existingItem.name;
    existingItem.type = req.body.type || existingItem.type;
    existingItem.price = parseFloat(req.body.price) || existingItem.price;
    if (req.file) {
        existingItem.imageUrl = `/uploads/${req.file.filename}`;
    }

    await writeData(items);
    res.json({ message: 'Item updated', items });
});

// DELETE: ลบข้อมูลในไฟล์ JSON
// app.delete('/items/:id', async (req, res) => {
//     let items = await readData();
//     const { id } = req.params;

//     const index = items.findIndex(item => item.id == id);
//     if (index === -1) {
//         return res.status(404).json({ message: 'Item not found' });
//     }

//     // ลบข้อมูลตาม ID
//     items.splice(index, 1);
//     await writeData(items);
//     res.json({ message: 'Item deleted', items });
// });


// ในส่วนของ DELETE API
app.delete('/items/:id', async (req, res) => {
    let items = await readData();
    const { id } = req.params;

    const index = items.findIndex(item => item.id == id);
    if (index === -1) {
        return res.status(404).json({ message: 'Item not found' });
    }

    // ลบไฟล์รูปภาพถ้ามี
    if (items[index].imageUrl) {
        const imagePath = path.join(__dirname, items[index].imageUrl);
        try {
            await fs.unlink(imagePath);
        } catch (err) {
            console.error('Error deleting image file:', err);
        }
    }

    // ลบข้อมูลสินค้าจาก array
    items.splice(index, 1);
    await writeData(items);
    res.json({ message: 'Item deleted', items });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
