package logger

import (
	"fmt"
	"strings"

	"github.com/go-kratos/kratos/v2/log"
)

// ANSI color codes
const (
	Reset = "\033[0m"
	Bold  = "\033[1m"

	Red    = "\033[31m"
	Green  = "\033[32m"
	Yellow = "\033[33m"
	Blue   = "\033[34m"
	Purple = "\033[35m"
	Cyan   = "\033[36m"
	Gray   = "\033[90m"
	White  = "\033[97m"
)

type coloredLogger struct{}

func New() log.Logger {
	return &coloredLogger{}
}

func (l *coloredLogger) Log(level log.Level, keyvals ...interface{}) error {
	// ---- level color ----
	levelColor := Reset
	switch level {
	case log.LevelDebug:
		levelColor = Gray
	case log.LevelInfo:
		levelColor = Green
	case log.LevelWarn:
		levelColor = Yellow
	case log.LevelError:
		levelColor = Red
	case log.LevelFatal:
		levelColor = Purple
	}

	// ---- prefix ----
	buf := fmt.Sprintf(
		"%s[%s]%s",
		levelColor,
		strings.ToUpper(level.String()),
		Reset,
	)

	// ---- key=val ----
	for i := 0; i < len(keyvals); i += 2 {
		k := fmt.Sprint(keyvals[i])
		var v interface{}
		if i+1 < len(keyvals) {
			v = keyvals[i+1]
		}

		color := Gray

		switch {
		case k == "ts":
			color = Blue
		case k == "caller":
			color = Purple
		case strings.HasPrefix(k, "service."):
			color = Cyan
		case k == "msg":
			color = White + Bold
		}

		buf += fmt.Sprintf(
			" %s%s%s=%s%v%s",
			color, k, Reset,
			color, v, Reset,
		)
	}

	fmt.Println(buf)
	return nil
}
