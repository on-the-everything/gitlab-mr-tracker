.PHONY: deploy

deploy:
	bun run build && wrangler pages deploy dist