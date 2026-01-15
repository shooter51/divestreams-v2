# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e6]: DS
    - heading "DiveStreams Admin" [level=1] [ref=e7]
    - paragraph [ref=e8]: Sign in with your platform admin account
  - generic [ref=e9]:
    - generic [ref=e10]: An error occurred during login. Please try again.
    - generic [ref=e11]:
      - generic [ref=e12]: Email address
      - textbox "Email address" [active] [ref=e13]:
        - /placeholder: admin@example.com
    - generic [ref=e14]:
      - generic [ref=e15]: Password
      - generic [ref=e16]:
        - textbox "Password" [ref=e17]:
          - /placeholder: Enter your password
        - button [ref=e18]:
          - img [ref=e19]
    - button "Sign In" [ref=e22]
  - paragraph [ref=e23]: Platform admin access only. Regular users should sign in at their organization's subdomain.
```