document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Track last deletion for undo functionality
  let lastDeletion = null;
  let undoTimer = null;

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      // Reset activity select so we don't duplicate options on each fetch
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Create participants list
        const participantsList = details.participants.length > 0
          ? details.participants.map(p => `<li><span class="participant-email">${p}</span><button class="delete-participant" data-activity="${name}" data-email="${p}" title="Remove participant">✕</button></li>`).join("")
          : "<li><em>No participants yet</em></li>";

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <p><strong>Participants (${details.participants.length}/${details.max_participants}):</strong></p>
          <ul class="participants-list">
            ${participantsList}
          </ul>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Attach delete handlers to all delete buttons
      document.querySelectorAll(".delete-participant").forEach(button => {
        button.addEventListener("click", async (e) => {
          e.preventDefault();
          const activity = button.getAttribute("data-activity");
          const email = button.getAttribute("data-email");

          // Prevent double-clicks
          if (button.disabled) return;
          button.disabled = true;

          try {
            const response = await fetch(
              `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
              { method: "DELETE" }
            );

            if (response.ok) {
              // Remove the participant row from the DOM immediately for a snappy UX
              const li = button.closest('li');
              if (li) li.remove();

              // Save deletion so it can be undone
              lastDeletion = { activity, email };

              // Show undo message
              messageDiv.innerHTML = `Unregistered ${email} from ${activity} <button id="undo-btn" class="undo-button">Undo</button>`;
              messageDiv.className = "success";
              messageDiv.classList.remove("hidden");

              // Clear any existing undo timer
              if (undoTimer) clearTimeout(undoTimer);

              // Start undo timer: if not undone within 5s, finalize by reloading activities
              undoTimer = setTimeout(() => {
                lastDeletion = null;
                messageDiv.classList.add("hidden");
                undoTimer = null;
                fetchActivities();
              }, 5000);

              // Attach a one-time undo handler
              const undoBtn = document.getElementById("undo-btn");
              const handleUndo = async () => {
                // Prevent multiple clicks
                if (!lastDeletion) return;
                const deletionToRestore = lastDeletion;
                lastDeletion = null;
                if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }

                try {
                  const readdResponse = await fetch(
                    `/activities/${encodeURIComponent(deletionToRestore.activity)}/signup?email=${encodeURIComponent(deletionToRestore.email)}`,
                    { method: "POST" }
                  );

                  if (readdResponse.ok) {
                    messageDiv.textContent = `Restored ${deletionToRestore.email} to ${deletionToRestore.activity}`;
                    messageDiv.className = "success";
                    fetchActivities();
                  } else {
                    // Restore state so user can try again
                    lastDeletion = deletionToRestore;
                    messageDiv.textContent = "Failed to restore participant";
                    messageDiv.className = "error";
                  }
                } catch (error) {
                  lastDeletion = deletionToRestore;
                  messageDiv.textContent = "Failed to restore participant. Please try again.";
                  messageDiv.className = "error";
                  console.error("Error restoring:", error);
                }
                // hide message after brief delay if still present
                setTimeout(() => { if (!lastDeletion) messageDiv.classList.add('hidden'); }, 3000);
              };

              if (undoBtn) {
                // Remove any previous listener by replacing the element with a clone
                const newUndo = undoBtn.cloneNode(true);
                undoBtn.parentNode.replaceChild(newUndo, undoBtn);
                newUndo.addEventListener('click', handleUndo, { once: true });
              }
            } else {
              const error = await response.json();
              messageDiv.textContent = error.detail || "Failed to unregister";
              messageDiv.className = "error";
              messageDiv.classList.remove("hidden");
            }
          } catch (error) {
            messageDiv.textContent = "Failed to unregister. Please try again.";
            messageDiv.className = "error";
            messageDiv.classList.remove("hidden");
            console.error("Error unregistering:", error);
          } finally {
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Update the DOM immediately for the specific activity instead of reloading everything
        const activityCards = Array.from(document.querySelectorAll('.activity-card'));
        const targetCard = activityCards.find(card => {
          const title = card.querySelector('h4');
          return title && title.textContent.trim() === activity;
        });

        if (targetCard) {
          const participantsUl = targetCard.querySelector('.participants-list');
          if (participantsUl) {
            // If the list had the placeholder 'No participants yet', remove it
            const firstLi = participantsUl.querySelector('li');
            if (firstLi && firstLi.textContent.trim().startsWith('No participants')) {
              participantsUl.innerHTML = '';
            }

            // Create new participant li
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.className = 'participant-email';
            span.textContent = email;
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-participant';
            delBtn.setAttribute('data-activity', activity);
            delBtn.setAttribute('data-email', email);
            delBtn.title = 'Remove participant';
            delBtn.textContent = '✕';

            li.appendChild(span);
            li.appendChild(delBtn);
            participantsUl.appendChild(li);

            // Update the availability and participants count text
            const infoParagraphs = targetCard.querySelectorAll('p');
            infoParagraphs.forEach(p => {
              if (p.textContent.includes('Availability:')) {
                // Extract current spots left text and update
                const parts = p.textContent.split(':');
                if (parts.length > 1) {
                  // recompute based on DOM participants length and max from header text
                  const participantsCount = participantsUl.querySelectorAll('li').length;
                  // find max participants from the Participants (...) paragraph if exists
                  const participantsPara = Array.from(infoParagraphs).find(pp => pp.textContent.includes('Participants ('));
                  if (participantsPara) {
                    const match = participantsPara.textContent.match(/Participants \((\d+)\/(\d+)\)/);
                    let max = null;
                    if (match) max = parseInt(match[2], 10);
                    if (max) {
                      const spotsLeft = max - participantsCount;
                      p.textContent = `\u00a0 Availability: ${spotsLeft} spots left`;
                      participantsPara.textContent = `Participants (${participantsCount}/${max}):`;
                    }
                  }
                }
              }
            });

            // Attach delete handler to the newly added delete button
            delBtn.addEventListener('click', async (e) => {
              e.preventDefault();
              // reuse existing delete flow by dispatching click
              delBtn.disabled = true;
              try {
                const res = await fetch(`/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
                if (res.ok) {
                  // remove from DOM and show undo
                  li.remove();
                  lastDeletion = { activity, email };
                  if (undoTimer) clearTimeout(undoTimer);
                  messageDiv.innerHTML = `Unregistered ${email} from ${activity} <button id="undo-btn" class="undo-button">Undo</button>`;
                  messageDiv.className = 'success';
                  messageDiv.classList.remove('hidden');
                  undoTimer = setTimeout(() => { lastDeletion = null; messageDiv.classList.add('hidden'); fetchActivities(); undoTimer = null; }, 5000);
                  const undoBtn = document.getElementById('undo-btn');
                  if (undoBtn) {
                    const newUndo = undoBtn.cloneNode(true);
                    undoBtn.parentNode.replaceChild(newUndo, undoBtn);
                    newUndo.addEventListener('click', async () => {
                      if (!lastDeletion) return;
                      const deletionToRestore = lastDeletion; lastDeletion = null; if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
                      try {
                        const re = await fetch(`/activities/${encodeURIComponent(deletionToRestore.activity)}/signup?email=${encodeURIComponent(deletionToRestore.email)}`, { method: 'POST' });
                        if (re.ok) { messageDiv.textContent = `Restored ${deletionToRestore.email} to ${deletionToRestore.activity}`; messageDiv.className = 'success'; fetchActivities(); }
                        else { lastDeletion = deletionToRestore; messageDiv.textContent = 'Failed to restore participant'; messageDiv.className = 'error'; }
                      } catch (err) { lastDeletion = deletionToRestore; messageDiv.textContent = 'Failed to restore participant. Please try again.'; messageDiv.className = 'error'; }
                    }, { once: true });
                  }
                } else {
                  const err = await res.json();
                  messageDiv.textContent = err.detail || 'Failed to unregister';
                  messageDiv.className = 'error';
                  messageDiv.classList.remove('hidden');
                }
              } catch (err) {
                messageDiv.textContent = 'Failed to unregister. Please try again.';
                messageDiv.className = 'error';
                messageDiv.classList.remove('hidden');
              } finally {
                delBtn.disabled = false;
              }
            });
          }
        } else {
          // If we can't find the card (maybe not loaded), just reload everything
          fetchActivities();
        }

        signupForm.reset();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
