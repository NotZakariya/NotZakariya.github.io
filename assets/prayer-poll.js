// Supabase configuration
const SUPABASE_URL = 'https://lvtpabteeewssuupfnzlm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dHBhYnRlZXdzc3V1cGZuemxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTIzNzEsImV4cCI6MjA5NDE2ODM3MX0.q5U43Vb1SEp-kbeF4LOfGa9KQTC_9d2rrorNTCzOd-Q';

// Prayer names
const PRAYERS = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];
const VOTE_TYPES = ['Attending', 'Not Attending'];

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store poll data in memory
let pollData = {};

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Check if it's past 22:15 (reset threshold)
function shouldResetPolls() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return hours >= 22 && minutes >= 15;
}

// Initialize polls for all prayers
async function initializePolls() {
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
  const attending = pollData[prayer]['Attending'] || 0;
  const notAttending = pollData[prayer]['Not Attending'] || 0;

  const container = document.querySelector(`[data-prayer="${prayer}"] .prayer-poll`);
  if (container) {
    container.innerHTML = `
      <div class="poll-votes">
        <button class="poll-btn attending" data-prayer="${prayer}" data-vote="Attending">
          ✓ Attending <span class="poll-count">${attending}</span>
        </button>
        <button class="poll-btn not-attending" data-prayer="${prayer}" data-vote="Not Attending">
          ✗ Not Attending <span class="poll-count">${notAttending}</span>
        </button>
      </div>
    `;

    // Re-attach event listeners
    attachPollListeners();
  }
}

// Handle vote click
async function castVote(prayer, voteType) {
  const today = getTodayDate();

  try {
    // Store user's vote in localStorage (one vote per prayer per day)
    const votingKey = `prayer_vote_${prayer}_${today}`;
    localStorage.setItem(votingKey, voteType);

    // Increment vote count
    const { error } = await supabase.rpc('increment_poll_vote', {
      p_prayer_name: prayer,
      p_vote_type: voteType,
      p_day_date: today,
    });

    if (error) {
      // Fallback: direct update if RPC doesn't exist
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

// Daily reset check (runs every minute)
function setupDailyReset() {
  setInterval(async () => {
    if (shouldResetPolls()) {
      // Reset all polls by deleting yesterday's data and reinitializing
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().split('T')[0];

        await supabase
          .from('polls')
          .delete()
          .eq('day_date', yesterdayDate);

        // Reinitialize for today
        await initializePolls();
      } catch (err) {
        console.error('Error resetting polls:', err);
      }
    }
  }, 60000); // Check every minute
}

// Start everything on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Load Supabase library
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4';
  script.onload = () => {
    initializePolls();
    setupRealtimeSubscription();
    setupDailyReset();
  };
  document.head.appendChild(script);
});
