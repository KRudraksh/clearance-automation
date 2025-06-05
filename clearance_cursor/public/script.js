document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registrationForm = document.getElementById('registrationForm');
    const modal = document.getElementById('registrationModal');
    const newUserBtn = document.getElementById('newUser');
    const cancelBtn = document.getElementById('cancelRegistration');
    const notification = document.getElementById('notification');

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                window.location.href = '/dashboard.html';
            } else {
                showNotification('Invalid credentials', 'error');
            }
        } catch (error) {
            showNotification('Server error', 'error');
        }
    });

    // Registration form submission
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        if (password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }

        const userData = {
            name: document.getElementById('regName').value,
            email: document.getElementById('regEmail').value,
            username: document.getElementById('regUsername').value,
            password: password,
        };

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (response.ok) {
                showNotification('User Created Successfully!', 'success');
                modal.style.display = 'none';
                registrationForm.reset();
            } else {
                const data = await response.json();
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Server error', 'error');
        }
    });

    // Show registration modal
    newUserBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    // Hide registration modal
    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        registrationForm.reset();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            registrationForm.reset();
        }
    });

    function showNotification(message, type = 'success') {
        notification.textContent = message;
        notification.style.backgroundColor = type === 'success' ? 'var(--success-color)' : 'var(--error-color)';
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}); 