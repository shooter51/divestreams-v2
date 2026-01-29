# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - heading "The Dive Shop LA" [level=1] [ref=e5]
    - paragraph [ref=e6]: Sign in to your account
  - generic [ref=e7]:
    - generic [ref=e8]: Invalid email or password
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11]: Email
        - textbox "Email" [ref=e12]: e2e-user@example.com
      - generic [ref=e13]:
        - generic [ref=e14]: Password
        - textbox "Password" [ref=e15]
    - button "Sign In" [ref=e16]
    - link "Forgot your password?" [ref=e17] [cursor=pointer]:
      - /url: /auth/forgot-password
```