/* eslint-disable @typescript-eslint/no-unused-vars */
// Use DOMContentLoaded to ensure elements exist
window.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('reset-form');
    const messageDiv = document.getElementById('message');
    const formContainer = document.getElementById('form-container');
    const submitBtn = document.getElementById('submit-btn');
    const tokenInput = document.getElementById('token-input');

    // Extract token from URL and immediately strip it from the address bar
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    window.history.replaceState({}, '', window.location.pathname);

    if (!token) {
        if (formContainer) formContainer.classList.add('hidden');
        showMessage('Invalid or missing reset token. Please request a new link.', 'error');
        return;
    }

    // Immediate token validation check
    try {
        const checkResponse = await fetch(`/api/v1/auth/verify-reset-token?token=${token}`);
        if (!checkResponse.ok) {
            const errorData = await checkResponse.json();
            if (formContainer) formContainer.classList.add('hidden');
            showMessage(errorData.message || 'This reset link has expired or is invalid.', 'error');
            return;
        }
        if (tokenInput) tokenInput.value = token;
    } catch {
        if (formContainer) formContainer.classList.add('hidden');
        showMessage('Unable to verify reset link. Please check your connection and try again.', 'error');
        return;
    }

    // --- Simple Text-based Toggle Password Visibility ---
    const toggles = document.querySelectorAll('.toggle-password');
    toggles.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.textContent = isPassword ? 'Hide' : 'Show';
            }
        });
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const currentToken = tokenInput ? tokenInput.value : token;

            if (password !== confirmPassword) {
                showMessage("Passwords don't match", 'error');
                return;
            }

            setLoading(true);

            try {
                const response = await fetch('/api/v1/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: currentToken, password, confirmPassword }),
                });

                const result = await response.json();

                if (response.ok) {
                    if (formContainer) formContainer.classList.add('hidden');
                    showMessage('Password reset successful! You can now log in.', 'success');
                } else {
                    showMessage(result.message || 'An error occurred', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please check your connection.', 'error');
            } finally {
                setLoading(false);
            }
        });
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = `message ${type}`;
            messageDiv.classList.remove('hidden');
        }
    }

    function setLoading(isLoading) {
        if (submitBtn) {
            submitBtn.disabled = isLoading;
            submitBtn.textContent = isLoading ? 'Resetting...' : 'Reset Password';
        }
    }
});
