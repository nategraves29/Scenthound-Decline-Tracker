// 1. Restore the last manager's name so they don't have to type it every time
document.getElementById('managerName').value = localStorage.getItem('extManagerName') || '';

// 2. Show/Hide "Other" text box
document.getElementById('reasonsBox').addEventListener('change', (e) => {
    const isOtherChecked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                                .some(cb => cb.value.includes('Other'));
    document.getElementById('customReasonLabel').style.display = isOtherChecked ? 'block' : 'none';
    document.getElementById('customReason').style.display = isOtherChecked ? 'block' : 'none';
});

// 3. Scrape MyTime automatically when the popup opens
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    let currentTab = tabs[0];
    document.getElementById('myTimeLink').value = currentTab.url;

    chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: scrapeMyTimeData,
    }, (results) => {
        if (results && results[0] && results[0].result) {
            document.getElementById('petAndParentName').value = results[0].result;
        } else {
            document.getElementById('petAndParentName').value = "Not on a MyTime profile";
        }
    });
});

// This specific function gets injected into the webpage you are looking at
function scrapeMyTimeData() {
    let parentEl = document.querySelector('h1.client-show__name');
    let parentName = parentEl ? parentEl.textContent.replace('', '').trim() : '';

    let dogEl = document.querySelector('span.qa-auto-child-label');
    let dogName = dogEl ? dogEl.textContent.replace('', '').replace('', '').trim() : '';

    if (dogName && parentName) return `${dogName} & ${parentName}`;
    if (dogName) return dogName;
    if (parentName) return parentName;
    return '';
}

// 4. Send Data to Firebase
document.getElementById('submitBtn').addEventListener('click', async () => {
    const managerName = document.getElementById('managerName').value;
    const location = document.getElementById('location').value;
    const petAndParentName = document.getElementById('petAndParentName').value;
    const myTimeLink = document.getElementById('myTimeLink').value;
    const customReason = document.getElementById('customReason').value;
    const notificationMethod = document.getElementById('notificationMethod').value;
    const notesField = document.getElementById('notesField').value;
    
    const selectedReasons = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    if (!managerName || selectedReasons.length === 0) {
        alert("Please enter your name and select at least one reason.");
        return;
    }

    localStorage.setItem('extManagerName', managerName); // Save name for next time
    document.getElementById('submitBtn').innerText = "Saving...";
    document.getElementById('submitBtn').disabled = true;

    // Direct REST API call to your exact Firestore database
    const firestoreEndpoint = "https://firestore.googleapis.com/v1/projects/scenthound-decline-tracker/databases/(default)/documents/declined_appointments";
    
    const payload = {
        fields: {
            managerName: { stringValue: managerName },
            location: { stringValue: location },
            petAndParentName: { stringValue: petAndParentName },
            myTimeLink: { stringValue: myTimeLink },
            reasons: { arrayValue: { values: selectedReasons.map(r => ({ stringValue: r })) } },
            customReason: { stringValue: customReason },
            notificationMethod: { stringValue: notificationMethod },
            notes: { stringValue: notesField },
            timestamp: { stringValue: new Date().toISOString() },
            dateDisplay: { stringValue: new Date().toLocaleDateString() }
        }
    };

    try {
        const response = await fetch(firestoreEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById('status').innerText = "✅ Successfully Logged!";
            document.getElementById('status').style.color = "#27AE60";
            setTimeout(() => window.close(), 1500); // Closes popup after 1.5s
        } else {
            throw new Error("Failed to save");
        }
    } catch (error) {
        document.getElementById('status').innerText = "❌ Error saving entry.";
        document.getElementById('status').style.color = "#E74C3C";
        document.getElementById('submitBtn').innerText = "Try Again";
        document.getElementById('submitBtn').disabled = false;
    }
});
