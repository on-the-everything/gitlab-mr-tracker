.PHONY: deploy

w.login:
	wrangler login

w.deploy:
	bun run build && wrangler pages deploy dist
