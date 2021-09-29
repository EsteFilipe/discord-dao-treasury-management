import { Button, Divider } from "antd";
import React, { useState, useEffect } from "react";
import { login } from "../util/auth";

const url = require('url');

export default function DiscordAuth({
  userSigner
}) {

	const [shares, setShares] = useState();
  const [isOwner, setIsOwner] = useState();
	const [error, setError] = useState();
	const [userIdToken, setUserIdToken] = useState()

    useEffect(() => {
			const href = window.location.href;
			console.log(href)
			const parsedUrl = url.parse(href, true);
			const query = parsedUrl.query;
			if (query.id) {
				setUserIdToken(query.id);
			}
    }, []);

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, height: 300, margin: "auto", marginTop: 64 }}>
        <h2>Discord Authentication:</h2>
        <Divider />
        <div style={{ margin: 8 }}>
          <Button
            style={{ marginTop: 8 }}
            onClick={async () => {
							setError(null);
              const result = await login({ 
								signer: userSigner,
								userIdToken: userIdToken // This is a JWT which will be decoded in the lambda
							});
              console.log(result);
              if (result.owner) {
								setIsOwner(result.owner)
							}
							if (result.shares) {
              	setShares(result.shares);
							}
							if (result.error) {
								setError(result.error)
							}
            }}
          >
            Authenticate!
          </Button>
          <div style={{ padding: 16 }}>
            {isOwner && <p>You've been authenticated as the <strong>owner of the vault</strong>.</p>}
            {shares > 0 && <p>You've been authenticated as an <strong>investor</strong>. You own {shares} shares.</p>}
          </div>
					{error && <div style={{ padding: 16 }}>Error: {error}</div>}
        </div>
      </div>
    </div>
  );
}
