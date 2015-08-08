;; http://codewinds.com/blog/2015-04-02-emacs-flycheck-eslint-jsx.html
;; turn on flychecking globally
(add-hook 'after-init-hook #'global-flycheck-mode)

;; disable jshint since we prefer eslint checking
(setq-default flycheck-disabled-checkers
  (append flycheck-disabled-checkers
    '(javascript-jshint)))

;; use eslint with web-mode for jsx files
(flycheck-add-mode 'javascript-eslint 'web-mode)

(flycheck-define-checker javascript-flow
  "A JavaScript syntax and style checker using Flow.
See URL `http://flowtype.org/'."
  :command ("flow" source-original)
  :error-patterns
  ((error line-start
	  (file-name)
	  ":"
	  line
	  ":"
	  (minimal-match (one-or-more not-newline))
	  ": "
	  (message (minimal-match (and (one-or-more anything) "\n")))
	  line-end))
  :modes (js-mode js2-mode js3-mode))

(add-to-list 'flycheck-checkers 'javascript-flow)
(flycheck-add-next-checker 'javascript-gjslint 'javascript-flow)
(flycheck-add-next-checker 'javascript-jshint 'javascript-flow)
(flycheck-add-next-checker 'javascript-eslint 'javascript-flow)
