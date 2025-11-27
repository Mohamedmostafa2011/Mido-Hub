// --- CONFIGURATION ---
const SUPABASE_URL = "https://oocwrzdfygieywntcsdv.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vY3dyemRmeWdpZXl3bnRjc2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNTkyMjIsImV4cCI6MjA3OTgzNTIyMn0.me2293EfGeWIRwoFijoyF-uHYtO8JH5_hR5RgEvIziY"; 

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

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxVideo = document.getElementById('lightbox-video');

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

// --- 2. UTILS: Download, Copy, and Lightbox ---

// A. Force Download (Smart Mobile/PC check)
window.forceDownload = async (url, filename) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const downloadUrl = url + '?t=' + Date.now(); 
        window.open(downloadUrl, '_blank');
        return;
    }
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(link);
    } catch (err) {
        window.open(url, '_blank');
    }
};

// B. Copy Text
window.copyToClipboard = (textId, btn) => {
    const textElement = document.getElementById(textId);
    if (!textElement) return;
    navigator.clipboard.writeText(textElement.innerText).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.style.color = '#00ff00';
        setTimeout(() => {
            btn.innerHTML = '<i class="far fa-copy"></i>';
            btn.style.color = '';
        }, 2000);
    });
};

// C. Lightbox Logic (Open Full Screen)
window.openLightbox = (url, type) => {
    lightbox.classList.add('active');
    if (type === 'image') {
        lightboxImg.style.display = 'block';
        lightboxVideo.style.display = 'none';
        lightboxImg.src = url;
    } else if (type === 'video') {
        lightboxImg.style.display = 'none';
        lightboxVideo.style.display = 'block';
        lightboxVideo.src = url;
        lightboxVideo.play();
    }
};

window.closeLightbox = () => {
    lightbox.classList.remove('active');
    lightboxImg.src = '';
    lightboxVideo.pause();
    lightboxVideo.src = '';
};

// --- 3. File Logic ---
function handleFileSelection(file) {
    selectedFile = file;
    filePreviewArea.style.display = 'flex';
    if (!file.name) {
        const ext = file.type.split('/')[1] || 'png';
        file.name = `pasted_${Date.now()}.${ext}`;
    }
    fileNameDisplay.innerText = file.name;
    textInput.placeholder = "File attached...";
}

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFileSelection(e.target.files[0]);
});

textInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.kind === 'file') {
            e.preventDefault();
            handleFileSelection(item.getAsFile());
        }
    }
});

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    filePreviewArea.style.display = 'none';
    textInput.placeholder = "Type message...";
    progContainer.style.display = 'none';
});

// --- 4. Send Logic ---
msgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text && !selectedFile) return;

    submitBtn.disabled = true;
    let finalFileUrl = null;
    let finalFileName = null;

    try {
        if (selectedFile) {
            progContainer.style.display = 'block';
            progressBar.style.width = '30%';
            
            const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const storagePath = `${Date.now()}_${safeName}`;
            
            const { error } = await supabase.storage.from('mido-files').upload(storagePath, selectedFile);
            if (error) throw error;

            progressBar.style.width = '80%';
            const { data } = supabase.storage.from('mido-files').getPublicUrl(storagePath);
            finalFileUrl = data.publicUrl;
            finalFileName = selectedFile.name;
        }

        const { error } = await supabase.from('messages').insert([{
            username: currentUser,
            text_content: text,
            file_url: finalFileUrl,
            file_name: finalFileName
        }]);

        if (error) throw error;

        progressBar.style.width = '100%';
        setTimeout(() => {
            textInput.value = '';
            selectedFile = null;
            filePreviewArea.style.display = 'none';
            fileInput.value = '';
            progContainer.style.display = 'none';
            progressBar.style.width = '0%';
            submitBtn.disabled = false;
        }, 500);

    } catch (err) {
        alert(err.message);
        submitBtn.disabled = false;
    }
});

// --- 5. Realtime & Render ---
function setupRealtime() {
    const channel = supabase.channel('room1');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') { renderMessage(payload.new); scrollToBottom(); }
        if (payload.eventType === 'DELETE') { const el = document.getElementById(`msg-${payload.old.id}`); if(el) el.remove(); }
    }).subscribe();
}

async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
        chatContainer.innerHTML = '';
        data.forEach(renderMessage);
        scrollToBottom();
    }
}

window.deleteMessage = async (id) => {
    if(confirm('Delete?')) await supabase.from('messages').delete().eq('id', id);
};

// --- RENDER LOGIC ---
function renderMessage(msg) {
    const isMe = msg.username === currentUser;
    const div = document.createElement('div');
    div.className = `msg-wrapper ${isMe ? 'my-msg' : 'other-msg'}`;
    div.id = `msg-${msg.id}`;

    let content = '';
    
    // 1. Text
    if (msg.text_content) {
        const textId = `text-${msg.id}`;
        content += `
            <div class="text-group">
                <p id="${textId}">${msg.text_content}</p>
                <button class="copy-btn" onclick="copyToClipboard('${textId}', this)"><i class="far fa-copy"></i></button>
            </div>`;
    }
    
    // 2. File
    if (msg.file_url) {
        const name = msg.file_name || 'File';
        const ext = name.split('.').pop().toLowerCase();
        const dlButton = `<button class="dl-btn" onclick="event.stopPropagation(); forceDownload('${msg.file_url}', '${name}')"><i class="fas fa-download"></i></button>`;

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            // Image: Added onclick to openLightbox
            content += `
                <div class="media-container" onclick="openLightbox('${msg.file_url}', 'image')">
                    <img src="${msg.file_url}" class="img-preview">
                    ${dlButton}
                </div>`;
        } else if (['mp4', 'webm', 'ogg'].includes(ext)) {
            // Video: Added onclick to openLightbox
            content += `
                <div class="media-container" onclick="openLightbox('${msg.file_url}', 'video')">
                    <video class="video-preview"><source src="${msg.file_url}"></video>
                    ${dlButton}
                </div>`;
        } else {
            // Other files: Click opens in new tab (default view)
            content += `
                <div class="file-card" onclick="window.open('${msg.file_url}', '_blank')">
                    <div class="file-icon"><i class="fas fa-file"></i></div>
                    <div class="file-info"><span class="file-name">${name}</span><span class="click-hint">Click to Open</span></div>
                    <div class="download-icon" onclick="event.stopPropagation(); forceDownload('${msg.file_url}', '${name}')"><i class="fas fa-arrow-down"></i></div>
                </div>`;
        }
    }

    let deleteBtn = isMe ? `<span class="delete-icon" onclick="deleteMessage(${msg.id})"><i class="fas fa-trash"></i></span>` : '';

    div.innerHTML = `
        <div class="sender-name">${isMe ? 'You' : msg.username} ${deleteBtn}</div>
        <div class="msg-bubble">${content}</div>
    `;
    
    chatContainer.appendChild(div);
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

checkAuth();
