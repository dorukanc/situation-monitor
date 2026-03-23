export const CONFIG = {
  github: {
    username: process.env.NEXT_PUBLIC_GITHUB_USERNAME || "your-username",
    refreshInterval: 5 * 60 * 1000, // 5 minutes
  },
  pomodoro: {
    workMinutes: 25,
    breakMinutes: 5,
  },
  efficiency: {
    targetFocusHours: 4,
    targetCommits: 8,
    targetTodos: 5,
  },
  spotify: {
    pollInterval: 3000, // ms — how often to check playback state
    playlistLimit: 20,
  },
  hackerNews: {
    refreshInterval: 15 * 60 * 1000, // 15 minutes
    storyCount: 5,
  },
};
