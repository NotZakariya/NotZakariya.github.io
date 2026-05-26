// Supabase configuration
const SUPABASE_URL = 'https://lvtpabteewssuupfnzlm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dHBhYnRlZXdzc3V1cGZuemxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTIzNzEsImV4cCI6MjA5NDE2ODM3MX0.q5U43Vb1SEp-kbeF4LOfGa9KQTC_9d2rrorNTCzOd-Q';

// Prayer names
const PRAYERS = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];
const POLL_TYPES = [
  { label: 'Brothers Attending' },
  { label: 'Sisters Attending' },
];

let supabase = null;

// Store poll data in memory
let pollData = {};

function normalizeServerPrayerName(name) {
  for (const p of PRAYERS) {
    if (String(name).toLowerCase().startsWith(p.toLowerCase())) return p;
  }
  return name;
}

function loadSupabaseLibrary() {
  return new Promise((resolve, reject) => {
    if (window.supabase && window.supabase.createClient) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-supabase="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Supabase library')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4';
    script.dataset.supabase = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Supabase library'));
    document.head.appendChild(script);
  });
}

function formatResetTime(resetTime) {
  const [hours = '00', minutes = '00'] = String(resetTime).split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

async function loadResetTime() {
  const resetTimeEl = document.getElementById('poll-reset-time');
  if (!supabase || !resetTimeEl) return;

  const { data, error } = await supabase
    .from('poll_settings')
    .select('reset_time')
    .eq('id', true)
    .single();

  if (error) {
    console.error('Error loading poll reset time:', error);
    return;
  }

  if (data?.reset_time) {
    resetTimeEl.textContent = `The poll resets at ${formatResetTime(data.reset_time)} every day`;
  }
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Initialize polls for all prayers
async function initializePolls() {
  if (!supabase) return;
  const today = getTodayDate();

  for (const prayer of PRAYERS) {
    try {
      // Ensure rows exist for each vote type for this prayer (select => insert if missing)
      for (const { label } of POLL_TYPES) {
        const { data: exists, error: checkErr } = await supabase
          .from('polls')
          .select('id')
          .eq('prayer_name', prayer)
          .eq('vote_type', label)
          .eq('day_date', today)
          .limit(1);

        if (checkErr) {
          console.error('Error checking existing poll row', checkErr);
          continue;
        }

        if (!exists || exists.length === 0) {
          const { error: insertErr } = await supabase
            .from('polls')
            .insert([
              { prayer_name: prayer, vote_type: label, vote_count: 0, day_date: today },
            ]);

          if (insertErr) console.error('Error inserting poll row', insertErr);
        }
      }

      await loadPollData(prayer);
    } catch (err) {
      console.error(`Error initializing poll for ${prayer}:`, err);
    }
  }
}

// Load poll data for a specific prayer
async function loadPollData(prayer) {
  if (!supabase) return;
  const today = getTodayDate();
  try {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .eq('prayer_name', prayer)
      .eq('day_date', today);

    if (error) throw error;

    pollData[prayer] = {};
    if (data) {
      for (const row of data) {
        const serverPrayer = normalizeServerPrayerName(row.prayer_name);
        if (String(serverPrayer).toLowerCase() !== String(prayer).toLowerCase()) continue;
        pollData[prayer][row.vote_type] = row.vote_count;
      }
    }

    updatePollDisplay(prayer);
  } catch (err) {
    console.error(`Error loading poll data for ${prayer}:`, err);
  }
}

// Update UI for a prayer's poll
function updatePollDisplay(prayer) {
  const container = document.querySelector(`[data-prayer="${prayer}"] .prayer-poll`);
  if (container) {
    const today = getTodayDate();
    const buttons = POLL_TYPES.map(({ label }) => {
      const voteCount = (pollData[prayer] && pollData[prayer][label]) || 0;
      const localKey = `prayer_vote_${prayer}_${label}_${today}`;
      const localVote = localStorage.getItem(localKey);
      const colorClass = label === 'Brothers Attending' ? 'brothers' : label === 'Sisters Attending' ? 'sisters' : 'attending';

      return `
        <button class="poll-btn ${colorClass} ${localVote === label ? 'voted' : ''}" data-prayer="${prayer}" data-vote="${label}">
          ${label} <span class="poll-count">${voteCount}</span>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="poll-votes">
        ${buttons}
      </div>
    `;

    // Re-attach event listeners
    attachPollListeners();
  }
}

// Handle vote click
async function castVote(prayer, voteType) {
  if (!supabase) return;
  console.log('[prayer-poll] castVote called', { prayer, voteType });
  const today = getTodayDate();
  const votingKey = `prayer_vote_${prayer}_${voteType}_${today}`;
  const currentVote = localStorage.getItem(votingKey);
  const dbPrayerName = prayer;
  const storedVoteType = voteType;

  try {
    if (currentVote === voteType) {
      const selectRes = await supabase
        .from('polls')
        .select('vote_count')
        .eq('prayer_name', dbPrayerName)
        .eq('vote_type', storedVoteType)
        .eq('day_date', today)
        .single();
      console.log('[prayer-poll] selectRes (decrement):', selectRes);

      if (selectRes.error) throw selectRes.error;
      const data = selectRes.data;

      if (data) {
        const updateRes = await supabase
          .from('polls')
          .update({ vote_count: Math.max(0, data.vote_count - 1) })
          .eq('prayer_name', dbPrayerName)
          .eq('vote_type', storedVoteType)
          .eq('day_date', today);
        console.log('[prayer-poll] updateRes (decrement):', updateRes);
        if (updateRes.error) throw updateRes.error;
      }

      localStorage.removeItem(votingKey);
    } else {
      const selectRes = await supabase
        .from('polls')
        .select('vote_count')
        .eq('prayer_name', dbPrayerName)
        .eq('vote_type', storedVoteType)
        .eq('day_date', today)
        .single();
      console.log('[prayer-poll] selectRes (increment):', selectRes);

      if (selectRes.error) throw selectRes.error;
      const data = selectRes.data;

      if (data) {
        const updateRes = await supabase
          .from('polls')
          .update({ vote_count: data.vote_count + 1 })
          .eq('prayer_name', dbPrayerName)
          .eq('vote_type', storedVoteType)
          .eq('day_date', today);
        console.log('[prayer-poll] updateRes (increment):', updateRes);
        if (updateRes.error) throw updateRes.error;
      }

      localStorage.setItem(votingKey, voteType);
    }

    // Reload poll data
    await loadPollData(prayer);
  } catch (err) {
    console.error(`Error casting vote for ${prayer}:`, err);
  }
}

// Attach event listeners to poll buttons
function attachPollListeners() {
  document.querySelectorAll('.poll-btn').forEach((btn) => {
    btn.onclick = () => {
      const prayer = btn.dataset.prayer;
      const voteType = btn.dataset.vote;
      castVote(prayer, voteType);
    };
  });
}

// Set up real-time subscription
function setupRealtimeSubscription() {
  if (!supabase) return;
  supabase
    .channel('polls-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'polls',
      },
      (payload) => {
        const prayer = payload.new?.prayer_name ? normalizeServerPrayerName(payload.new.prayer_name) : null;
        if (prayer) {
          loadPollData(prayer);
        }
      }
    )
    .subscribe();
}

// Start everything on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadSupabaseLibrary();
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await loadResetTime();
    await initializePolls();
    setupRealtimeSubscription();
  } catch (err) {
    console.error('Poll initialization failed:', err);
  }
});
