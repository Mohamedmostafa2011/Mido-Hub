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
const submitBtn = document.getElementById('submit-btn');

let currentUser = localStorage.getItem('mido_user');
let selectedFile = null;

// --- 1. Auth Logic ---
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

// --- 2. File Logic (Browse & Paste) ---

function handleFileSelection(file) {
    selectedFile = file;
    filePreviewArea.style.display = 'flex';
    
    // If pasted, generate a name
    if (!file.name || file.name === 'image.png') {
        const ext = file.type.split('/')[1] || 'png';
        file.name = `pasted_image.${ext}`; // Just a display name
        // We add a timestamp later for uniqueness
    }
    
    fileNameDisplay.innerText = file.name;
    textInput.placeholder = "File attached. Hit send...";
}

// A. Browse Button
fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleFileSelection(e.target.files[0]);
    }
});

// B. Paste (Ctrl+V) Logic
textInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.kind === 'file') {
            e.preventDefault();
            const blob = item.getAsFile();
            handleFileSelection(blob);
        }
    }
});

// C. Remove File Button
removeFileBtn.addEventListener('click', () => {
    clearFileSelection();
});

function clearFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    filePreviewArea.style.display = 'none';
    textInput.placeholder = "Type message or paste image...";
    progContainer.style.display = 'none'; // Hide loading bar
    progressBar.style.width = '0%';
}

// --- 3. Send Logic ---
msgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();

    if (!text && !selectedFile) return;

    submitBtn.disabled = true;
    
    let finalFileUrl = null;
    let finalFileName = null;

    try {
        // A. Upload File (If exists)
        if (selectedFile) {
            progContainer.style.display = 'block';
            progressBar.style.width = '30%'; // Started

            // Create unique name: timestamp_cleanName
            const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const storagePath = `${Date.now()}_${safeName}`;
            
            const { data, error } = await supabase.storage
                .from('mido-files')
                .upload(storagePath, selectedFile);

            if (error) throw error;

            progressBar.style.width = '80%'; // Uploaded
            
            // Get URL
            const { data: publicUrlData } = supabase.storage
                .from('mido-files')
                .getPublicUrl(storagePath);
                
            finalFileUrl = publicUrlData.publicUrl;
            finalFileName = selectedFile.name;
        }

        // B. Database Insert
        const { error: dbError } = await supabase
            .from('messages')
            .insert([{
                username: currentUser,
                text_content: text,
                file_url: finalFileUrl,
                file_name: finalFileName
            }]);

        if (dbError) throw dbError;

        // C. Success Cleanup
        progressBar.style.width = '100%';
        setTimeout(() => {
            textInput.value = '';
            clearFileSelection();
            submitBtn.disabled = false;
        }, 500);

    } catch (err) {
        console.error(err);
        alert('Error: ' + err.message);
        // IMPORTANT: Reset UI on error so it doesn't get stuck
        submitBtn.disabled = false;
        progressBar.style.background = 'red';
        setTimeout(() => {
             progressBar.style.width = '0%';
             progressBar.style.background = '#03dac6'; // reset color
             progContainer.style.display = 'none';
        }, 2000);
    }
});

// --- 4. Realtime & Delete Logic ---

function setupRealtime() {
    const channel = supabase.channel('room1');
    channel.on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'messages' }, 
        (payload) => {
            if (payload.eventType === 'INSERT') {
                renderMessage(payload.new);
                scrollToBottom();
            }
            if (payload.eventType === 'DELETE') {
                const msgDiv = document.getElementById(`msg-${payload.old.id}`);
                if (msgDiv) msgDiv.remove();
            }
        }
    ).subscribe();
}

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

// Delete Function attached to window
window.deleteMessage = async (id) => {
    if(confirm('Delete this message?')) {
        await supabase.from('messages').delete().eq('id', id);
    }
};

function renderMessage(msg) {
    const isMe = msg.username === currentUser;
    const div = document.createElement('div');
    div.className = `msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}`;
    div.id = `msg-${msg.id}`;

    let content = '';
    
    if (msg.text_content) content += `<p>${msg.text_content}</p>`;
    
    if (msg.file_url) {
        const isImg = msg.file_url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i);
        if (isImg) {
            content += `<a href="${msg.file_url}" target="_blank"><img src="${msg.file_url}" class="img-preview"></a>`;
        } else {
            content += `<a href="${msg.file_url}" target="_blank" class="file-link"><i class="fas fa-download"></i> ${msg.file_name || 'File'}</a>`;
        }
    }

    let deleteBtn = '';
    if (isMe) {
        deleteBtn = `<span class="delete-icon" onclick="deleteMessage(${msg.id})"><i class="fas fa-trash"></i></span>`;
    }

    div.innerHTML = `
        <div class="sender-name">${isMe ? 'You' : msg.username} ${deleteBtn}</div>
        <div class="msg-bubble">${content}</div>
    `;
    
    chatContainer.appendChild(div);
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Run
checkAuth();
