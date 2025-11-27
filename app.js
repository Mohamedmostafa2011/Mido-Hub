// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyCrY2EVicQTifAf4HbATljI9c9Ra4wcH9c",
  authDomain: "mido-hub.firebaseapp.com",
  projectId: "mido-hub",
  storageBucket: "mido-hub.firebasestorage.app",
  messagingSenderId: "539001172832",
  appId: "1:539001172832:web:007add458c8bc1ab6f6405"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const hubScreen = document.getElementById('hub-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const displayName = document.getElementById('display-name');
const msgForm = document.getElementById('msg-form');
const textInput = document.getElementById('text-input');
const fileInput = document.getElementById('file-input');
const chatContainer = document.getElementById('chat-container');
const filePreviewArea = document.getElementById('file-preview-area');
const fileNameDisplay = document.getElementById('file-name-display');
const removeFileBtn = document.getElementById('remove-file');
const progressBar = document.getElementById('progress-bar');
const progContainer = document.getElementById('progress-bar-container');
const logoutBtn = document.getElementById('logout-btn');

let currentUser = localStorage.getItem('mido_user');
let selectedFile = null;

// --- 1. Authentication Logic ---
function checkAuth() {
    if (currentUser) {
        showHub();
    } else {
        loginScreen.classList.add('active');
        hubScreen.classList.remove('active');
    }
}

function showHub() {
    loginScreen.classList.remove('active');
    hubScreen.classList.add('active');
    displayName.innerText = currentUser;
    loadMessages();
}

loginBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        localStorage.setItem('mido_user', currentUser);
        checkAuth();
    } else {
        alert("Please enter a username");
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('mido_user');
    location.reload();
});

// --- 2. File Handling Logic ---
fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        selectedFile = e.target.files[0];
        filePreviewArea.style.display = 'flex';
        fileNameDisplay.innerText = selectedFile.name;
        textInput.placeholder = "Add a caption (optional)...";
    }
});

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    filePreviewArea.style.display = 'none';
    textInput.placeholder = "Type text or upload file...";
});

// --- 3. Sending Logic (Text OR File OR Both) ---
msgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();

    if (!text && !selectedFile) return; // Don't send empty

    // Disable button while sending
    document.getElementById('submit-btn').disabled = true;

    let fileUrl = null;
    let fileName = null;
    let fileType = null;

    try {
        // A. Handle File Upload if exists
        if (selectedFile) {
            progContainer.style.display = 'block';
            const storageRef = ref(storage, 'uploads/' + Date.now() + '_' + selectedFile.name);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            // Wait for upload
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        progressBar.style.width = progress + '%';
                    }, 
                    (error) => reject(error), 
                    () => resolve()
                );
            });

            fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
            fileName = selectedFile.name;
            fileType = selectedFile.type;
        }

        // B. Add to Database
        await addDoc(collection(db, "messages"), {
            user: currentUser,
            text: text,
            fileUrl: fileUrl,
            fileName: fileName,
            fileType: fileType,
            timestamp: serverTimestamp()
        });

        // Reset Form
        textInput.value = '';
        fileInput.value = '';
        selectedFile = null;
        filePreviewArea.style.display = 'none';
        progContainer.style.display = 'none';
        progressBar.style.width = '0%';
        document.getElementById('submit-btn').disabled = false;

    } catch (err) {
        console.error("Error sending message: ", err);
        alert("Error sending message. Check console.");
        document.getElementById('submit-btn').disabled = false;
    }
});

// --- 4. Real-time Listener ---
function loadMessages() {
    chatContainer.innerHTML = ''; // Clear loader
    
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snapshot) => {
        chatContainer.innerHTML = ''; // Re-render prevents duplicates efficiently for simple apps
        snapshot.forEach((doc) => {
            renderMessage(doc.data());
        });
        // Auto scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

function renderMessage(msg) {
    if(!msg.timestamp) return; // Skip pending writes locally for smoother exp

    const isMe = msg.user === currentUser;
    const div = document.createElement('div');
    div.className = `msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}`;

    let content = '';

    // 1. Add Text
    if (msg.text) {
        content += `<p>${msg.text}</p>`;
    }

    // 2. Add File
    if (msg.fileUrl) {
        if (msg.fileType && msg.fileType.startsWith('image/')) {
            // Image
            content += `<a href="${msg.fileUrl}" target="_blank"><img src="${msg.fileUrl}" class="img-preview" alt="image"></a>`;
        } else {
            // Other file
            content += `
                <a href="${msg.fileUrl}" target="_blank" class="file-link">
                    <i class="fas fa-download"></i> ${msg.fileName}
                </a>`;
        }
    }

    div.innerHTML = `
        <div class="sender-name">${isMe ? 'You' : msg.user}</div>
        <div class="msg-bubble">
            ${content}
        </div>
    `;

    chatContainer.appendChild(div);
}

// Run on Load
checkAuth();
