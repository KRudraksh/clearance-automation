document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('adminCredentials')) {
        window.location.href = '/adminLogin.html';
        return;
    }
    
    loadUsers();
    loadStats();

    // Logout button handler
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('adminCredentials');
        window.location.href = '/adminLogin.html';
    });
});

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': getAuthHeader()
            }
        });
        const users = await response.json();
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.name}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td class="password-cell">
                    <span class="password-text">••••••••</span>
                    <button class="action-btn show-password-btn" onclick="togglePassword(this, '${user.password}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
                <td>${user.jobCount}</td>
                <td>
                    <button class="action-btn delete-user-btn" onclick="confirmDelete('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showNotification('Error loading users', 'error');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': getAuthHeader()
            }
        });
        const stats = await response.json();
        
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('totalJobs').textContent = stats.totalJobs;
        document.getElementById('activeUsers').textContent = stats.activeUsers;
    } catch (error) {
        showNotification('Error loading statistics', 'error');
    }
}

function confirmDelete(userId) {
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'block';
    
    document.getElementById('confirmDelete').onclick = async () => {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': getAuthHeader()
                }
            });
            
            if (response.ok) {
                showNotification('User deleted successfully', 'success');
                loadUsers();
                loadStats();
            } else {
                throw new Error('Failed to delete user');
            }
        } catch (error) {
            showNotification('Error deleting user', 'error');
        }
        modal.style.display = 'none';
    };
    
    document.getElementById('cancelDelete').onclick = () => {
        modal.style.display = 'none';
    };
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function getAuthHeader() {
    const credentials = localStorage.getItem('adminCredentials');
    return credentials ? `Basic ${credentials}` : '';
}

function togglePassword(button, hashedPassword) {
    const passwordCell = button.parentElement;
    const passwordText = passwordCell.querySelector('.password-text');
    const icon = button.querySelector('i');
    
    if (passwordText.textContent === '••••••••') {
        passwordText.textContent = hashedPassword;
        icon.className = 'fas fa-eye-slash';
    } else {
        passwordText.textContent = '••••••••';
        icon.className = 'fas fa-eye';
    }
} 