import './style.css';
import './judge.css';

const form = document.querySelector('#judge-form');
const fields = document.querySelector('#application-fields');
const status = document.querySelector('#form-status');
const button = document.querySelector('#submit-application');
const endpoint = (import.meta.env.VITE_JUDGE_FORM_ENDPOINT ?? 'https://formspree.io/f/mzeejrbr').trim();

// Form IDs are public; never put account credentials in a VITE_ variable.
if (/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint)) {
  form.action = endpoint;
  form.method = 'POST';
  fields.disabled = false;
  status.textContent = '';
  status.hidden = true;
}

let submitting = false;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (fields.disabled || submitting || !form.reportValidity()) return;
  submitting = true;
  button.disabled = true;
  button.textContent = 'Submitting…';
  status.hidden = false;
  status.textContent = 'Sending your application…';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error('Submission rejected');
    form.hidden = true;
    status.textContent = 'Thank you! Your application has been received. The organizing team will follow up by email.';
    status.tabIndex = -1;
    status.focus();
  } catch {
    status.textContent = 'We couldn’t confirm your submission. Please try again in a moment. Your answers are still here.';
    button.disabled = false;
    button.textContent = 'Submit application';
  } finally {
    submitting = false;
  }
});
