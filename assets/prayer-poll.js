// Supabase configuration
const SUPABASE_URL = 'https://lvtpabteewssuupfnzlm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dHBhYnRlZXdzc3V1cGZuemxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTIzNzEsImV4cCI6MjA5NDE2ODM3MX0.q5U43Vb1SEp-kbeF4LOfGa9KQTC_9d2rrorNTCzOd-Q';

// Prayer names
const PRAYERS = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];
const VOTE_TYPES = ['Attending'];

let supabase = null;

// Store poll data in memory
let pollData = {};

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
      // Get or create poll entries for this prayer
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('prayer_name', prayer)
        .eq('day_date', today);

      if (error) throw error;

      if (!data || data.length === 0) {
        // Create initial entries
        for (const voteType of VOTE_TYPES) {
          await supabase
            .from('polls')
            .insert([
              {
                prayer_name: prayer,
                vote_type: voteType,
                vote_count: 0,
                day_date: today,
              },
            ]);
        }
      }

      // Load poll data
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
  const attending = (pollData[prayer] && pollData[prayer]['Attending']) || 0;
  const container = document.querySelector(`[data-prayer="${prayer}"] .prayer-poll`);
  if (container) {
    // Check local vote to show which option is toggled
    const today = getTodayDate();
    const localKey = `prayer_vote_${prayer}_${today}`;
    const localVote = localStorage.getItem(localKey);

    container.innerHTML = `
      <div class="poll-votes">
        <button class="poll-btn attending ${localVote === 'Attending' ? 'voted' : ''}" data-prayer="${prayer}" data-vote="Attending">
          ✓ Attending <span class="poll-count">${attending}</span>
        </button>
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
  const votingKey = `prayer_vote_${prayer}_${today}`;
  const currentVote = localStorage.getItem(votingKey);

  try {
    // If clicking the same button, toggle off (remove vote)
    if (currentVote === voteType) {
      // Decrement current vote
      const { data } = await supabase
        .from('polls')
        .select('vote_count')
        .eq('prayer_name', prayer)
        .eq('vote_type', voteType)
        .eq('day_date', today)
        .single();

      if (data) {
        await supabase
          .from('polls')
          .update({ vote_count: Math.max(0, data.vote_count - 1) })
          .eq('prayer_name', prayer)
          .eq('vote_type', voteType)
          .eq('day_date', today);
      }

      // Remove from localStorage
      localStorage.removeItem(votingKey);
    } else {
      // If there's a previous vote, decrement it (switch behavior)
      if (currentVote) {
        const { data } = await supabase
          .from('polls')
          .select('vote_count')
          .eq('prayer_name', prayer)
          .eq('vote_type', currentVote)
          .eq('day_date', today)
          .single();

        if (data) {
          await supabase
            .from('polls')
            .update({ vote_count: Math.max(0, data.vote_count - 1) })
            .eq('prayer_name', prayer)
            .eq('vote_type', currentVote)
            .eq('day_date', today);
        }
      }

      // Increment new vote
      const { data } = await supabase
        .from('polls')
        .select('vote_count')
        .eq('prayer_name', prayer)
        .eq('vote_type', voteType)
        .eq('day_date', today)
        .single();

      if (data) {
        await supabase
          .from('polls')
          .update({ vote_count: data.vote_count + 1 })
          .eq('prayer_name', prayer)
          .eq('vote_type', voteType)
          .eq('day_date', today);
      }

      // Store new vote in localStorage
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
        const prayer = payload.new?.prayer_name;
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
