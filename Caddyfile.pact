# Caddyfile for Pact Broker
# Serves pact.dev.divestreams.com

pact.dev.divestreams.com {
    reverse_proxy pact-broker:9292

    # Enable gzip compression
    encode gzip

    # Access logs
    log {
        output stdout
        format json
    }
}
