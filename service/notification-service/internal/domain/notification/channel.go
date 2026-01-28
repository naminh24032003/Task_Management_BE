package notification

// Channel represents the notification delivery channel
type Channel string

const (
	ChannelInApp Channel = "in_app"
	ChannelEmail Channel = "email"
	ChannelPush  Channel = "push"
	ChannelSMS   Channel = "sms"
)

// String returns the string representation of the channel
func (c Channel) String() string {
	return string(c)
}

// IsValid checks if the channel is valid
func (c Channel) IsValid() bool {
	switch c {
	case ChannelInApp, ChannelEmail, ChannelPush, ChannelSMS:
		return true
	default:
		return false
	}
}

// Channels is a slice of Channel
type Channels []Channel

// Contains checks if the slice contains the given channel
func (cs Channels) Contains(channel Channel) bool {
	for _, c := range cs {
		if c == channel {
			return true
		}
	}
	return false
}

// DefaultChannels returns the default notification channels
func DefaultChannels() Channels {
	return Channels{ChannelInApp}
}

// AllChannels returns all available notification channels
func AllChannels() Channels {
	return Channels{ChannelInApp, ChannelEmail, ChannelPush, ChannelSMS}
}

// ChannelConfig represents configuration for a notification channel
type ChannelConfig struct {
	Channel    Channel `json:"channel" bson:"channel"`
	Enabled    bool    `json:"enabled" bson:"enabled"`
	Priority   int     `json:"priority" bson:"priority"` // Higher priority = preferred channel
	RateLimit  int     `json:"rate_limit" bson:"rate_limit"` // Max notifications per hour
}

// DefaultChannelConfigs returns default channel configurations
func DefaultChannelConfigs() []ChannelConfig {
	return []ChannelConfig{
		{Channel: ChannelInApp, Enabled: true, Priority: 100, RateLimit: 1000},
		{Channel: ChannelEmail, Enabled: true, Priority: 50, RateLimit: 50},
		{Channel: ChannelPush, Enabled: true, Priority: 75, RateLimit: 100},
		{Channel: ChannelSMS, Enabled: false, Priority: 25, RateLimit: 10},
	}
}
