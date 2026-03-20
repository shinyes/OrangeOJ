## OrangeOJ v1 瀹炴柦鏂规锛圙o + Fiber + SQLite + Docker Compose锛?
### Summary
- 鐩爣锛氫粠 0 寮€鍙?`OrangeOJ` 鍗曚綋绯荤粺锛屾敮鎸佺郴缁熺鐞嗗憳/绌洪棿绠＄悊鍛?鏅€氱敤鎴枫€佸绌洪棿棰樺簱銆佽缁冭鍒掋€佷綔涓氥€佸瑙傞涓庣紪绋嬮銆佸垽棰橀槦鍒椾笌璧勬簮闄愬埗銆?- 鏋舵瀯锛歚Go(Fiber) + React(Vite) + SQLite` 鍗曚綋搴旂敤锛屽悗绔唴缃垽棰?worker锛堥粯璁ゅ苟鍙?2锛屽彲閰嶇疆锛夛紝涓嶅紩鍏?Redis銆?- 宸查攣瀹氬叧閿喅绛栵細
  - 鍓嶇锛歚React + Vite + Monaco`
  - 鍒ら闅旂锛歚Docker 鐭敓鍛藉懆鏈熶换鍔″鍣╜
  - 閴存潈锛歚JWT + HttpOnly Cookie`
  - 绌洪棿棰樺簱涓庢牴棰樺簱鍏崇郴锛歚浠呭紩鐢ㄦ牴棰橈紝涓嶅仛鐗堟湰閿佸畾`
  - 浣滀笟锛歚娣峰悎棰樺瀷锛堝崟閫?鍒ゆ柇/缂栫▼锛塦
  - 缂栫▼棰橀〉闈細`杩愯=鑷畾涔夎緭鍏ワ紝娴嬭瘯=鏍蜂緥闆嗭紝淇濆瓨=鑽夌`
  - 娉ㄥ唽榛樿锛歚鍏抽棴`
  - 鍒濆 admin锛歚闅忔満瀵嗙爜锛屽惎鍔ㄦ棩蹇楁墦鍗颁竴娆
  - 杩愯鏃讹細`g++17 + Python3.8 + Go1.25锛堝悓澶х増鏈ˉ涓佸彲鏇夸唬锛塦
  - 缂栫▼棰樺緱鍒嗭細`AC / 闈濧C锛?鍒嗭級`

### Key Changes
#### 1) 绯荤粺涓庢ā鍧楄竟鐣?- 鍗曚粨瀹炵幇涓ら儴鍒嗭細
  - `backend`锛欶iber API銆丼QLite 鎸佷箙鍖栥€佸垽棰橀槦鍒椾笌 worker銆侀潤鎬佽祫婧愭墭绠?  - `frontend`锛歊eact 绠＄悊绔笌鍋氶绔紙鏋勫缓鍚庣敱 Fiber 鎵樼锛?- 涓嶆媶寰湇鍔★紱閫氳繃妯″潡鍒嗗眰淇濇寔绠€鍗曪細
  - `auth`銆乣rbac`銆乣spaces`銆乣problems`銆乣training`銆乣homework`銆乣submission`銆乣judge_queue`銆乣judge_runner`銆乣settings`

#### 2) 鏁版嵁妯″瀷锛圫QLite锛?- `users`锛歚id, username(unique), password_hash, global_role(system_admin|user), created_at`
- `system_settings`锛歚key, value`锛堝惈 `registration_enabled=false`锛?- `spaces`锛歚id, name, description, created_by, created_at`
- `space_members`锛歚space_id, user_id, role(space_admin|member), unique(space_id,user_id)`
- `root_problems`锛歚id, type(programming|single_choice|true_false), title, statement_md, body_json, answer_json, time_limit_ms(default 1000), memory_limit_mib(default 256), created_by`
- `space_problem_links`锛歚space_id, problem_id, unique(space_id,problem_id)`锛堜粎寮曠敤锛?- `training_plans`锛歚id, space_id, title, allow_self_join, published_at`
- `training_chapters`锛歚id, plan_id, title, order_no`
- `training_items`锛歚id, chapter_id, problem_id, order_no`
- `training_participants`锛歚plan_id, user_id, joined_by(admin|self), joined_at`
- `homeworks`锛歚id, space_id, title, description, due_at, created_by, published`
- `homework_items`锛歚homework_id, problem_id, order_no, score`
- `homework_targets`锛歚homework_id, user_id`
- `submissions`锛歚id, user_id, space_id, problem_id, question_type, language, source_code, submit_type(run|test|submit|objective), status, verdict, time_ms, memory_kib, score, stdout, stderr, created_at`
- `judge_jobs`锛歚id, submission_id, status(queued|running|done|failed), priority, available_at, started_at, finished_at, worker_token`
- `user_problem_progress`锛歚space_id, user_id, problem_id, best_verdict, best_score, last_submission_id`

#### 3) 瀵瑰鎺ュ彛锛堝叕寮€ API/绫诲瀷锛?- 璁よ瘉锛?  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/auth/register`锛堜粎褰?`registration_enabled=true`锛?  - `GET /api/auth/me`
- 绯荤粺绠＄悊锛?  - `GET/PUT /api/admin/settings/registration`
  - `GET/POST /api/admin/root-problems`
  - `PUT/DELETE /api/admin/root-problems/:id`
  - `GET/POST /api/admin/spaces`
- 绌洪棿绠＄悊锛?  - `GET /api/spaces`
  - `GET /api/spaces/:spaceId`
  - `POST /api/spaces/:spaceId/members`
  - `PUT /api/spaces/:spaceId/members/:userId`
  - `GET/POST/DELETE /api/spaces/:spaceId/problem-bank-links`
- 璁粌璁″垝锛?  - `GET/POST /api/spaces/:spaceId/training-plans`
  - `GET/PUT /api/spaces/:spaceId/training-plans/:planId`
  - `POST /api/spaces/:spaceId/training-plans/:planId/participants`
  - `POST /api/spaces/:spaceId/training-plans/:planId/join`锛堢敤鎴蜂富鍔ㄥ弬鍔狅級
- 浣滀笟锛?  - `GET/POST /api/spaces/:spaceId/homeworks`
  - `GET/PUT /api/spaces/:spaceId/homeworks/:homeworkId`
  - `POST /api/spaces/:spaceId/homeworks/:homeworkId/targets`
- 鍋氶涓庢彁浜わ細
  - `POST /api/spaces/:spaceId/problems/:problemId/objective-submit`锛堝崟閫?鍒ゆ柇鍗虫椂鍒ゅ垎锛?  - `POST /api/spaces/:spaceId/problems/:problemId/run`锛堣嚜瀹氫箟杈撳叆锛屽叆闃燂級
  - `POST /api/spaces/:spaceId/problems/:problemId/test`锛堟牱渚嬮泦锛屽叆闃燂級
  - `POST /api/spaces/:spaceId/problems/:problemId/submit`锛堟寮忓垽棰橈紝鍏ラ槦锛?  - `GET /api/submissions/:submissionId`
  - `GET /api/submissions/:submissionId/stream`锛堣疆璇㈡垨 SSE锛?
#### 4) 鍒ら涓庨槦鍒楀疄鐜?- 闃熷垪瀛樺偍浜?SQLite `judge_jobs`锛岀敓浜ц€呭湪浜嬪姟涓啓鍏?`submissions + judge_jobs`銆?- worker 姹犻粯璁?`2` 鍗忕▼骞跺彂锛堢幆澧冨彉閲忓彲閰嶏級锛屾瘡涓?worker 鍘熷瓙 claim 涓€鏉′换鍔★細
  - `UPDATE ... RETURNING` 鏂瑰紡棰嗗彇 `queued` 浠诲姟锛岄伩鍏嶉噸澶嶆秷璐广€?- 鍒ら瀹瑰櫒瀹夊叏鍙傛暟锛?  - `network=none`銆侀潪 root 鐢ㄦ埛銆佸彧璇?rootfs銆乣tmpfs /tmp`銆乣pids-limit`銆乣memory=棰樼洰闄愬埗`銆丆PU 闄愰銆佽秴鏃舵潃杩涚▼銆?- 璇█鎵ц娴佺▼锛?  - C++锛氱紪璇戝悗杩愯
  - Python锛氱洿鎺ヨ繍琛?  - Go锛氭瀯寤哄悗杩愯
- 鍒ら缁撴灉锛?  - 杩囩▼ verdict 浠嶈褰?`CE/RE/TLE/MLE/WA/AC`
  - 璇勫垎鎸変綘瑕佹眰锛氱紪绋嬮 `AC=婊″垎锛岄潪AC=0`
- 宕╂簝鎭㈠锛?  - 鏈嶅姟鍚姩鏃跺皢瓒呮椂 `running` 浠诲姟鍥炴粴涓?`queued`銆?
#### 5) 鍓嶇椤甸潰涓庝氦浜?- 鍏ㄥ眬椤甸潰锛氱櫥褰曘€佺郴缁熺鐞嗭紙鏍归搴?绌洪棿绠＄悊/娉ㄥ唽寮€鍏筹級銆佺┖闂村垪琛ㄣ€?- 绌洪棿椤甸潰锛氶搴撻〉銆佽缁冭鍒掗〉銆佷綔涓氶〉锛堢嫭绔嬭矾鐢憋級銆?- 棰樺瀷鏀寔锛?  - 鍗曢€夐锛氬崟閫夌粍浠?+ 鍗虫椂鍒ゅ垎
  - 鍒ゆ柇棰橈細True/False 缁勪欢 + 鍗虫椂鍒ゅ垎
  - 缂栫▼棰橈細Monaco 缂栬緫鍣?+ 璇█鍒囨崲 + 杩愯/娴嬭瘯/淇濆瓨/鎻愪氦
- 缂栫▼棰橀〉闈㈡寜绀轰緥鍥锯€滅粨鏋勯珮杩樺師+鐜颁唬鏍峰紡鈥濓細
  - 宸︽爮锛氶闈€佽緭鍏ヨ緭鍑烘牸寮忋€佹牱渚嬨€侀檺鍒?  - 鍙充笂锛氱紪杈戝櫒鍖猴紙Monaco锛?  - 鍙充笅锛氭帶鍒跺彴鏃ュ織鍖猴紙杩愯/娴嬭瘯/鍒ら缁撴灉锛?  - 鍝嶅簲寮忥細妗岄潰鍙屾爮锛岀Щ鍔ㄧ涓婁笅甯冨眬

#### 6) 鍚姩涓庨儴缃诧紙Docker Compose锛?- `docker-compose.yml` 鍗曟湇鍔?`orangeoj`锛?  - 鏆撮湶 `8080`
  - 鎸傝浇 `./data` 鎸佷箙鍖?SQLite
  - 鎸傝浇 Docker socket 浠ュ垱寤哄垽棰樺鍣?- 鍚姩鍒濆鍖栵細
  - 鑷姩杩佺Щ琛ㄧ粨鏋?  - 鑻ユ棤 admin锛屽垱寤?`admin` 鐢ㄦ埛
  - 闅忔満鐢熸垚瀵嗙爜骞朵粎鍦ㄥ惎鍔ㄦ棩蹇楁墦鍗颁竴娆?- 鍏抽敭鐜鍙橀噺锛?  - `ORANGEOJ_DB_PATH=/app/data/orangeoj.db`
  - `ORANGEOJ_JUDGE_WORKERS=2`
  - `ORANGEOJ_REGISTRATION_DEFAULT=false`
  - `ORANGEOJ_ADMIN_PASSWORD`锛堝彲閫夎鐩栵級

### Test Plan
- 鍗曞厓娴嬭瘯锛?  - RBAC锛堢郴缁熺鐞嗗憳/绌洪棿绠＄悊鍛?鏅€氱敤鎴锋潈闄愯竟鐣岋級
  - 娉ㄥ唽寮€鍏筹紙鍏抽棴鏃剁姝㈡敞鍐岋紝寮€鍚椂鍏佽锛?  - 瀹㈣棰樺垽鍒嗭紙鍗曢€?鍒ゆ柇锛?  - 闃熷垪鍘熷瓙棰嗗彇锛堝苟鍙戜笅涓嶉噸澶嶆秷璐癸級
- 闆嗘垚娴嬭瘯锛?  - 缂栫▼棰?`run/test/submit` 鍏ㄩ摼璺紙鍚秴鏃躲€佸唴瀛樿秴闄愩€佺紪璇戦敊璇級
  - 澶氱敤鎴峰苟鍙戞彁浜よ繘鍏ラ槦鍒楀苟鎸夊苟鍙戞暟鎵ц
  - 绌洪棿棰樺簱浠呭紩鐢ㄦ牴棰樺悗锛屾牴棰樻洿鏂板湪绌洪棿绔嬪嵆鐢熸晥
- UI 楠屾敹锛?  - 缂栫▼棰橀〉甯冨眬銆佹寜閽涔夈€佹帶鍒跺彴杈撳嚭绗﹀悎绾﹀畾
  - 绌洪棿涓夐〉闈紙棰樺簱/璁粌璁″垝/浣滀笟锛夊彲瀹屾暣闂幆浣跨敤

### Assumptions
- 杩欐槸鍗曟満閮ㄧ讲 v1锛圫QLite 鏈湴鏂囦欢锛夛紝涓嶅仛鍒嗗竷寮忛槦鍒椾笌澶氳妭鐐瑰垽棰樸€?- 绌洪棿棰樺簱涓嶅仛鐗堟湰閿佸畾锛屾牴棰樻洿鏂颁細鐩存帴褰卞搷绌洪棿鍐呬娇鐢ㄣ€?- 浣滀笟涓庤缁冨潎鍏佽娣峰悎棰樺瀷锛涚紪绋嬮璇勫垎閲囩敤 AC/闈濧C銆?- 鏆備笉鍖呭惈绔炶禌銆佹帓琛屾銆佹煡閲嶃€侀鐩鍏ュ鍑虹瓑鎵╁睍鍔熻兘銆?