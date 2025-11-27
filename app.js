// --- CONFIGURATION ---
// PASTE YOUR SUPABASE DETAILS HERE
const SUPABASE_URL = "https://oocwrzdfygieywntcsdv.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vY3dyemRmeWdpZXl3bnRjc2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNTkyMjIsImV4cCI6MjA3OTgzNTIyMn0.me2293EfGeWIRwoFijoyF-uHYtO8JH5_hR5RgEvIziY"; 

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
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

let currentUser = localStorage.getItem('mido_user');
let selectedFile = null;

// 1. Auth Logic
function checkAuth() {
    if (currentUser) {
        loginScreen.classList.remove('active');
        hubScreen.classList.add('active');
        displayName.innerText = currentUser;
        loadMessages();
        setupRealtime();
    } else {
        loginScreen.classList.add('active');
    }
}

loginBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        localStorage.setItem('mido_user', currentUser);
        checkAuth();
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('mido_user');
    location.reload();
});

// 2. File UI Logic
fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        selectedFile = e.target.files[0];
        filePreviewArea.style.display = 'flex';
        fileNameDisplay.innerText = selectedFile.name;
    }
});

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    filePreviewArea.style.display = 'none';
});

// 3. Send Logic
msgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();

    if (!text && !selectedFile) return;

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    
    let finalFileUrl = null;
    let finalFileName = null;

    try {
        // Upload File if exists
        if (selectedFile) {
            progContainer.style.display = 'block';
            progressBar.style.width = '30%';

            const fileName = `${Date.now()}_${selectedFile.name.replace(/\s/g, '_')}`;
            
            const { data, error } = await supabase.storage
                .from('mido-files')
                .upload(fileName, selectedFile);

            if (error) throw error;

            progressBar.style.width = '80%';
            
            // Get Public URL
            const { data: publicUrlData } = supabase.storage
                .from('mido-files')
                .getPublicUrl(fileName);
                
            finalFileUrl = publicUrlData.publicUrl;
            finalFileName = selectedFile.name;
        }

        // Insert into Database
        const { error: dbError } = await supabase
            .from('messages')
            .insert([{
                username: currentUser,
                text_content: text,
                file_url: finalFileUrl,
                file_name: finalFileName
            }]);

        if (dbError) throw dbError;

        // Reset UI
        progressBar.style.width = '100%';
        setTimeout(() => {
            textInput.value = '';
            fileInput.value = '';
            selectedFile = null;
            filePreviewArea.style.display = 'none';
            progContainer.style.display = 'none';
            progressBar.style.width = '0%';
            submitBtn.disabled = false;
        }, 500);

    } catch (err) {
        console.error(err);
        alert('Error sending: ' + err.message);
        submitBtn.disabled = false;
    }
});

// 4. Load & Realtime Logic
async function loadMessages() {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    if (!error) {
        chatContainer.innerHTML = '';
        data.forEach(renderMessage);
        scrollToBottom();
    }
}

function setupRealtime() {
    supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        renderMessage(payload.new);
        scrollToBottom();
    })
    .subscribe();
}

function renderMessage(msg) {
    const isMe = msg.username === currentUser;
    const div = document.createElement('div');
    div.className = `msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}`;

    let content = '';
    
    // Text
    if (msg.text_content) content += `<p>${msg.text_content}</p>`;
    
    // File
    if (msg.file_url) {
        const isImg = msg.file_url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
        if (isImg) {
            content += `<a href="${msg.file_url}" target="_blank"><img src="${msg.file_url}" class="img-preview"></a>`;
        } else {
            content += `<a href="${msg.file_url}" target="_blank" class="file-link"><i class="fas fa-download"></i> ${msg.file_name}</a>`;
        }
    }

    div.innerHTML = `
        <div class="sender-name">${isMe ? 'You' : msg.username}</div>
        <div class="msg-bubble">${content}</div>
    `;
    
    chatContainer.appendChild(div);
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Start
checkAuth();
