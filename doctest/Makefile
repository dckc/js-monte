CURL=curl


D1=doctestjs-master
D1ADDR=https://github.com/ianb/doctestjs/archive/master.zip

dev-dependencies: $(D1)/doctest.js $(D2)

$(D1)/doctest.js $(D1)/doctest.css: $(D1).zip
	unzip $(D1).zip
	touch $@

$(D1).zip:
	$(CURL) --location -o $@ $(D1ADDR)
