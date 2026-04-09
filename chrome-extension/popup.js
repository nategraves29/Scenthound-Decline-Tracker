// Restore the last manager's name so they don't have to type it every time
document.getElementById('managerName').value = localStorage.getItem('extManagerName') || '';

// Show/Hide "Other" text box
document.getElementById('reasonsBox').addEventListener('change', (e) => {
    const isOtherChecked = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                                .some(cb => cb.value.includes('Other'));
    document.getElementById('customReasonLabel').style.display = isOtherChecked ? 'block' : 'none';
    document.getElementById('customReason').style.display = isOtherChecked ? 'block' : 'none';
});

// Scrape MyTime automatically when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    let currentTab = tabs[0];
    document.getElementById('myTimeLink').value = currentTab.url;

    chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: scrapeMyTimeData,
    }, (results) => {
        if (results && results[0] && results[0].result) {
            let data = results[0].result;
            
            // Fill the separated names
            document.getElementById('dogName').value = data.dog;
            document.getElementById('parentName').value = data.parent;

            // Auto-select the location from the dropdown
            if (data.locationText) {
                const locSelect = document.getElementById('location');
                Array.from(locSelect.options).forEach(opt => {
                    if (data.locationText.toLowerCase().includes(opt.value.toLowerCase())) {
                        locSelect.value = opt.value;
                    }
                });
            }
        }
    });
});

// This function gets injected into the MyTime webpage
function scrapeMyTimeData() {
    let parentEl = document.querySelector('h1.client-show__name');
    let parentName = parentEl ? parentEl.textContent.replace('', '').trim() : '';

    let dogEl = document.querySelector('span.qa-auto-child-label');
    let dogName = dogEl ? dogEl.textContent.replace('', '').replace('', '').trim() : '';

    // Look through all icon blocks to find the specific one holding the location
    let locationText = '';
    let iconBlocks = document.querySelectorAll('.icon-prefixed-block__text');
    for (let block of iconBlocks) {
        let text = block.textContent.trim();
        if (text.includes('Cedar Mill') || text.includes('Tigard') || text.includes('Hillsboro') || text.includes('Sherwood')) {
            locationText = text;
            break; // We found the location, stop looking
        }
    }

    return {
        dog: dogName,
        parent: parentName,
        locationText: locationText
    };
}

// Send Data to Firebase
document.getElementById('submitBtn').addEventListener('click', async () => {
    const managerName = document.getElementById('managerName').value;
    const location = document.getElementById('location').value;
    const dogName = document.getElementById('dogName').value;
    const parentName = document.getElementById('parentName').value;
    const myTimeLink = document.getElementById('myTimeLink').value;
    const customReason = document.getElementById('customReason').value;
    const notificationMethod = document.getElementById('notificationMethod').value;
    const notesField = document.getElementById('notesField').value;
    
    const selectedReasons = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    if (!managerName || selectedReasons.length === 0) {
        alert("Please enter your name and select at least one reason.");
        return;
    }

    // Combine them to prevent breaking your web app's existing layout
    let combinedName = "N/A";
    if (dogName && parentName) combinedName = `${dogName} & ${parentName}`;
    else if (dogName) combinedName = dogName;
    else if (parentName) combinedName = parentName;

    localStorage.setItem('extManagerName', managerName);
    document.getElementById('submitBtn').innerText = "Saving...";
    document.getElementById('submitBtn').disabled = true;

    // Direct REST API call to Firestore
    const firestoreEndpoint = "https://firestore.googleapis.com/v1/projects/scenthound-decline-tracker/databases/(default)/documents/declined_appointments";
    
    const payload = {
        fields: {
            managerName: { stringValue: managerName },
            location: { stringValue: location },
            dogName: { stringValue: dogName },
            parentName: { stringValue: parentName },
            petAndParentName: { stringValue: combinedName }, // Still sending this for the old table
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
