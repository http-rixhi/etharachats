document.addEventListener('DOMContentLoaded', () => {
    // 1. Establish App State Memory Engine Context
    let socket = null;
    let currentUserProfile = null;

    // 2. DOM Elements Mapping Lookup Matrix
    const landingView = document.getElementById('landing-view');
    const openJoinBtn = document.getElementById('open-join-btn');
    const identityModal = document.getElementById('identity-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const joinForm = document.getElementById('join-form');
    
    const appView = document.getElementById('app-view');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const connPill = document.getElementById('conn-pill');
    const connStatusText = document.getElementById('conn-status-text');
    
    const usersListBox = document.getElementById('users-list-box');
    const userCountElement = document.getElementById('user-count');
    const messagesViewport = document.getElementById('messages-viewport');
    
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const toastContainer = document.getElementById('toast-container');

    // 3. UI Toast Engine Helper
    function showToast(message, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        
        toastContainer.appendChild(toast);
        
        // Auto-remove toast banner container element after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // Helper to sanitize inputs client-side
    function clientSanitize(str) {
        return str.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // 4. Operational View Switchers
    function showModal() { identityModal.classList.remove('hidden'); }
    function hideModal() { identityModal.classList.add('hidden'); }

    // 5. Connect and Initialize Socket Communications Pipeline
    function initializeSocketConnection(profileData) {
        const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://your-backend-url.onrender.com';
        // Explicit initialization targeting relative host domain parameters
        socket = io(BACKEND_URL);

        // System Handle Connection State Updates
        socket.on('connect', () => {
            connPill.classList.remove('disconnected');
            connStatusText.innerText = 'Connected';

            // Dispatch intent to establish full presence across the socket channel
            socket.emit('user-joined', profileData, (response) => {
                if (response.success) {
                    currentUserProfile = response.profile;
                    
                    // Transition View States smoothly
                    landingView.classList.add('hidden');
                    hideModal();
                    appView.classList.remove('hidden');
                    
                    showToast(`Welcome ${currentUserProfile.name}! Entered conversation stream.`, 'success');
                    messageInput.focus();
                } else {
                    showToast(response.error, 'error');
                    socket.disconnect();
                }
            });
        });

        socket.on('disconnect', () => {
            connPill.classList.add('disconnected');
            connStatusText.innerText = 'Reconnecting...';
            showToast('Connection interrupted. Attempting reconnection...', 'error');
        });

        // Real-Time Listener: Synchronize Server Map array variations
        socket.on('update-users', (usersArray) => {
            userCountElement.innerText = usersArray.length;
            usersListBox.innerHTML = ''; // Clear viewport track map

            usersArray.forEach(user => {
                const li = document.createElement('li');
                li.className = 'user-item';
                
                let genderIcon = '👤';
                if (user.gender === 'Male') genderIcon = '🙋‍♂️';
                if (user.gender === 'Female') genderIcon = '🙋‍♀️';

                li.innerHTML = `<span>${genderIcon}</span> <span class="user-item-name">${user.name}</span>`;
                if(socket.id === user.id) {
                    li.style.fontWeight = '700';
                    li.innerHTML += ' <small style="color:var(--primary-pink)">(You)</small>';
                }
                usersListBox.appendChild(li);
            });
        });

        // Real-Time Listener: Receive System or User Messages
        socket.on('receive-message', (payload) => {
            renderMessage(payload);
        });
    }

    // 6. Append dynamic DOM instances to viewport stream frame
    function renderMessage(payload) {
        const isSystemMessage = payload.system === true;
        const targetElement = document.createElement('div');

        if (isSystemMessage) {
            targetElement.className = 'system-notification';
            targetElement.innerText = payload.text;
        } else {
            const isOwnMessage = payload.id === socket.id;
            targetElement.className = `message-bubble ${isOwnMessage ? 'outgoing' : 'incoming'}`;

            let genderIcon = '👤';
            if (payload.gender === 'Male') genderIcon = '🙋‍♂️';
            if (payload.gender === 'Female') genderIcon = '🙋‍♀️';

            targetElement.innerHTML = `
                <div class="message-meta">
                    <span class="msg-sender-name">${genderIcon} ${payload.name}</span>
                    <span class="msg-timestamp">${payload.timestamp}</span>
                </div>
                <div class="message-body">${payload.text}</div>
            `;
        }

        messagesViewport.appendChild(targetElement);
        // Guarantee fluid auto-scroll down properties on active append actions
        messagesViewport.scrollTop = messagesViewport.scrollHeight;
    }

    // 7. Interactive Event Listeners Configuration Layer
    openJoinBtn.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', hideModal);

    // Form Intercept Verification Trigger
    joinForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('username').value;
        const selectedGender = document.querySelector('input[name="gender"]:checked')?.value;

        // Validation Layer Validation Pipeline Rule Enforcement
        const cleanName = clientSanitize(nameInput);

        if (!cleanName || cleanName.length < 2) {
            return showToast('Please supply a name containing at least 2 alpha characters.', 'error');
        }
        if (cleanName.length > 25) {
            return showToast('Name cannot exceed 25 characters.', 'error');
        }
        if (!selectedGender) {
            return showToast('Please select a gender identity tile to continue.', 'error');
        }

        // Initialize connection
        initializeSocketConnection({ name: cleanName, gender: selectedGender });
    });

    // Send Message Form Submit Pipeline Handlers
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const inputRaw = messageInput.value;
        const cleanMsg = clientSanitize(inputRaw);

        if (!cleanMsg || cleanMsg.length === 0) {
            return showToast('Message input box cannot be empty.', 'error');
        }
        if (cleanMsg.length > 500) {
            return showToast('Message processing threshold limit error.', 'error');
        }

        // Emit text string to backend channel
        socket.emit('send-message', cleanMsg, (ack) => {
            if (ack.success) {
                messageInput.value = ''; // Reset core UI value properties
                messageInput.focus();
            } else {
                showToast(ack.error, 'error');
            }
        });
    });

    // Standard Disconnect Routine Handler
    leaveRoomBtn.addEventListener('click', () => {
        if (socket) {
            socket.disconnect();
        }
        // Force reset UI view state tracking loops cleanly
        currentUserProfile = null;
        messagesViewport.innerHTML = '';
        usersListBox.innerHTML = '';
        appView.classList.add('hidden');
        landingView.classList.remove('hidden');
        showToast('You have exited the chat room session.', 'success');
    });
});
