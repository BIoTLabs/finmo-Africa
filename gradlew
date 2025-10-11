#!/bin/sh

##############################################################################
# Gradle wrapper script for Ionic/Capacitor builds
# This script forwards to the actual gradlew in the android directory
##############################################################################

# Resolve links: $0 may be a link
PRG="$0"
# Need this for relative symlinks.
while [ -h "$PRG" ] ; do
    ls=`ls -ld "$PRG"`
    link=`expr "$ls" : '.*-> \(.*\)$'`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=`dirname "$PRG"`"/$link"
    fi
done
SAVED="`pwd`"
cd "`dirname \"$PRG\"`/" >/dev/null
APP_HOME="`pwd -P`"
cd "$SAVED" >/dev/null

# Ensure android/gradlew has execute permissions
chmod +x "$APP_HOME/android/gradlew" 2>/dev/null || true

# Forward to android/gradlew with all arguments
exec "$APP_HOME/android/gradlew" "$@"
