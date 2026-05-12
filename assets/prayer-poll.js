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

function getPollDbKey(prayer, voteLabel) {
  return `${prayer} - ${voteLabel}`;
}

function getPrayerFromDbKey(dbKey) {
  for (const prayer of PRAYERS) {
    if (dbKey.startsWith(prayer + ' - ')) {
      return prayer;
    }
  }
  return dbKey;
}

function getPollQueryValues(prayer, voteLabel) {
  return { prayer_name: getPollDbKey(prayer, voteLabel), vote_type: voteLabel };
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
      const pollDbKeys = POLL_TYPES.map(({ label }) => getPollQueryValues(prayer, label).prayer_name);
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .in('prayer_name', pollDbKeys)
        .eq('day_date', today);

      if (error) throw error;

      const existingDbKeys = new Set((data || []).map((row) => row.prayer_name));

      for (const { label } of POLL_TYPES) {
        const { prayer_name: dbKey, vote_type } = getPollQueryValues(prayer, label);
        if (existingDbKeys.has(dbKey)) {
          continue;
        }

        await supabase
          .from('polls')
          .upsert([
            {
              prayer_name: dbKey,
              vote_type,
              vote_count: 0,
              day_date: today,
            },
          ], {
            onConflict: 'prayer_name,day_date',
          });
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
  const pollDbKeys = POLL_TYPES.map(({ label }) => getPollQueryValues(prayer, label).prayer_name);

  try {
    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .in('prayer_name', pollDbKeys)
      .eq('day_date', today);

    if (error) throw error;

    pollData[prayer] = {};
    if (data) {
      for (const row of data) {
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
  const today = getTodayDate();
  const votingKey = `prayer_vote_${prayer}_${voteType}_${today}`;
  const currentVote = localStorage.getItem(votingKey);
  const { prayer_name: dbKey, vote_type: storedVoteType } = getPollQueryValues(prayer, voteType);

  try {
    if (currentVote === voteType) {
      const { data } = await supabase
        .from('polls')
        .select('vote_count')
        .eq('prayer_name', dbKey)
        .eq('vote_type', storedVoteType)
        .eq('day_date', today)
        .single();

      if (data) {
        await supabase
          .from('polls')
          .update({ vote_count: Math.max(0, data.vote_count - 1) })
          .eq('prayer_name', dbKey)
          .eq('vote_type', storedVoteType)
          .eq('day_date', today);
      }

      localStorage.removeItem(votingKey);
    } else {
      const { data } = await supabase
        .from('polls')
        .select('vote_count')
        .eq('prayer_name', dbKey)
        .eq('vote_type', storedVoteType)
        .eq('day_date', today)
        .single();

      if (data) {
        await supabase
          .from('polls')
          .update({ vote_count: data.vote_count + 1 })
          .eq('prayer_name', dbKey)
          .eq('vote_type', storedVoteType)
          .eq('day_date', today);
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
        const prayer = payload.new?.prayer_name ? getPrayerFromDbKey(payload.new.prayer_name) : null;
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
    await initializePolls();
    setupRealtimeSubscription();
  } catch (err) {
    console.error('Poll initialization failed:', err);
  }
});
