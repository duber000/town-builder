export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.color = 'white';
    notification.style.zIndex = '2000';
    notification.style.maxWidth = '300px';

    // Set color based on type
    if (type === 'success') {
        notification.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
    } else if (type === 'error') {
        notification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    } else {
        notification.style.backgroundColor = 'rgba(0, 123, 255, 0.9)';
    }

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

// Other UI-related functions...
