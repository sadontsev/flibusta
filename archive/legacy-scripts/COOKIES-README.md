# Legacy cookie helper files

This directory used to contain:
- nginx_cookies.txt
- cookies.txt
- cookies_direct.txt
- persistent_cookies.txt

They are archived and should not be used. The current system downloads SQL and cover archives directly via UpdateService. If you need cookies for specific network environments, manage them via environment variables or secure secrets, not committed files.
