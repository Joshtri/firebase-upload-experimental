const express = require('express');
const path = require('path');
const app = express();
require('dotenv').config();
const bodyParser = require('body-parser'); // Import body-parser
const mongoose = require('mongoose');

const { upload, uploadMultiple } = require('./middleware/multer')


// Inisialisasi MongoDB
mongoose.connect('mongodb+srv://stuffofyos151:8eKo00MEhl5yE7TH@cluster0.vm9wxsm.mongodb.net/test');

const { getStorage, ref, list ,uploadBytesResumable, getDownloadURL } = require('firebase/storage')
const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require("firebase/auth");
const { auth } = require('./config/firebase.config');


const Item = mongoose.model('Item', {
    name: String,
    description: String,
    fileId: String,
}, 'Items'); // 'nama_koleksi' adalah nama koleksi yang diinginkan

  

// createUserWithEmailAndPassword(auth, 'arifwb.work@gmail.com', 'dizztro41')
//   .then((userCredential) => {
//     // Signed in 
//     const user = userCredential.user;
//     console.log(user);
//     // ...
//   })
//   .catch((error) => {
//     const errorCode = error.code;
//     const errorMessage = error.message;
//     // ..
//   });

app.set('view engine', 'ejs');

app.set("views",[
    path.join(__dirname, "/views"),

])

const storageFB = getStorage();
// Gunakan body-parser middleware
app.use(bodyParser.json());


// Fungsi untuk mengunggah file ke Firebase Storage dan menyimpan data teks ke MongoDB
async function uploadImage(file, itemData, quantity) {
    try {
        // Sign in ke Firebase jika belum
        await signInWithEmailAndPassword(auth, process.env.FIREBASE_USER, process.env.FIREBASE_AUTH);

        // Mengunggah file ke Firebase Storage
        const dateTime = Date.now();
        const fileName = `images/${dateTime}`;
        const storageRef = ref(storageFB, fileName);
        const metadata = {
            contentType: file.type,
        };
        await uploadBytesResumable(storageRef, file.buffer, metadata);

        // Menyimpan data teks ke MongoDB jika diperlukan
        if (quantity === 'single') {
            const newItem = new Item({
                name: itemData.name,
                description: itemData.description,
                fileId: fileName,
            });

            // Menyimpan item ke MongoDB
            await newItem.save();
        }

        return fileName;
    } catch (error) {
        console.error(error); // Mencetak kesalahan ke konsol
        throw error;
    }
}

// Rute untuk menangani pengunggahan file
app.post('/test-upload', upload, async (req, res) => {
    const file = {
        type: req.file.mimetype,
        buffer: req.file.buffer,
    };

    const itemData = {
        name: req.body.name,
        description: req.body.description,
    };

    try {
        // Memanggil fungsi untuk mengunggah file dan menyimpan data teks
        const buildImage = await uploadImage(file, itemData, 'single'); // Sesuaikan 'single' atau 'multiple' sesuai logika Anda

        // Mengirim respons dengan informasi yang diinginkan
        res.send({
            status: 'SUCCESS',
            imageName: buildImage,
            uploadedData: itemData, // Menyertakan variabel data yang diinput untuk MongoDB
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/upload-form', (req,res)=>{
    res.render('upload-form')
})

// Rute untuk mendapatkan URL semua gambar
app.get('/get-images', async (req, res) => {
    try {
      // Mendapatkan daftar item dari Firebase Storage
      const items = await list(ref(storageFB, 'images/'));
  
      // Membuat array untuk menyimpan URL gambar
      const imageUrls = [];
  
      // Mengambil URL untuk setiap item
      for (const item of items.items) {
        const imageUrl = await getDownloadURL(item);
        imageUrls.push(imageUrl);
      }
  
      res.render('upload-data', { images: imageUrls });
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
});

// Rute untuk menampilkan data dari koleksi Item
app.get('/data-item', async (req, res) => {
    try {
        // Mendapatkan semua item dari MongoDB
        const items = await Item.find();

        // Menyiapkan data untuk ditampilkan di tabel
        const dataForTable = await Promise.all(items.map(async (item) => {
            const fileName = item.fileId;
            const storageRef = ref(storageFB, fileName);
            const imageUrl = await getDownloadURL(storageRef);

            return {
                id: item._id,
                name: item.name,
                description: item.description,
                imageUrl,
            };
        }));

        // Merender halaman dengan data tabel
        res.render('data-item', { items: dataForTable });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

// Rute untuk menampilkan detail item
app.get('/detail/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).send('Item not found');
        }

        const fileName = item.fileId;
        const storageRef = ref(storageFB, fileName);
        const imageUrl = await getDownloadURL(storageRef);

        const dataForDetail = {
            id: item._id,
            name: item.name,
            description: item.description,
            imageUrl,
        };

        // Merender halaman dengan data detail
        res.render('detail-item', { item: dataForDetail });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


app.listen(process.env.PORT || 3000, (test) => {
  console.log('Server running on port 3000')
})

