-- Reviewed documentary locations, batch v1, 2026-10-31.
-- Input source recheck SHA-256: dfb685ba575caec895179b270768b9deb32ecc86dad5ac4f4fe14a3042625417
-- Production snapshot SHA-256: ef59980118cc5e6f61c2b11c3afb9dd1c1bf3ad20cf4eac34253d436822b45dc
-- 98 current points retained; only Chez Hao and Le Montmorency corrected.
-- Chez le Cultivateur (closed) and every other place are outside this batch.
-- Run with psql -X -v ON_ERROR_STOP=1 -f <this file> after migration 0092.
-- Default execution is atomic. Recipe-only mode is used solely by the isolated
-- SQL test to exercise this exact implementation in its own rollback transaction.
\set ON_ERROR_STOP on
\if :{?guet_cartography_recipe_only}
\else
  \set guet_cartography_recipe_only false
\endif
\if :guet_cartography_recipe_only
\else
  BEGIN;
\endif

CREATE TEMP TABLE guet_cartography_targets_20261031 (
  place_id uuid PRIMARY KEY, expected_name text NOT NULL,
  expected_lat double precision NOT NULL, expected_lng double precision NOT NULL,
  target_lat double precision NOT NULL, target_lng double precision NOT NULL,
  correct_coordinates boolean NOT NULL, serialized_float_tolerance boolean NOT NULL,
  source_url text NOT NULL, source_sha256 text NOT NULL, source_checked_at timestamptz NOT NULL
) ON COMMIT DROP;
INSERT INTO pg_temp.guet_cartography_targets_20261031 VALUES
  ('06b991d6-9e8a-5dd0-a11e-9df99e61e15b', 'Byblos Restaurant', 5.293572, -3.983763, 5.293572, -3.983763, false, false, 'https://app.chicmenu.io/c/BY23081128/menu', 'd542fcc1858c9483b0305150e41b2fcb838620991022bc1db0381f0628ae0e95', '2026-10-31T14:34:58.174972+00:00'),
  ('094a6fab-0b30-5e5b-a2da-5839a55d8dd6', 'Acoustic', 5.367844, -3.989791, 5.367844, -3.989791, false, false, 'https://app.chicmenu.io/c/AC09091321/menu', '6726f63b33084a0215d44d971a1e5a45a53bc3a4de2487abc0457a271db94ba4', '2026-10-31T14:34:45.718146+00:00'),
  ('0aa664ac-053e-524c-92e5-345c3758d77d', 'Allocodrome de Cocody', 5.338056, -3.999722, 5.338056, -3.999722, false, false, 'https://app.chicmenu.io/c/AL10091531/menu', 'bccb3b0147e6cac21637da5c489f4155b87aae57f7673b941e3c39a1e4ccb94e', '2026-10-31T14:34:48.031735+00:00'),
  ('0b398b81-3dea-5c08-9559-da6fa4b61c9e', 'Chef Emmanuel', 5.384489, -3.956196, 5.384489, -3.956196, false, false, 'https://app.chicmenu.io/c/CH24091124/menu', 'ada45f84d3f6f39ba15dc9a073ba432bd44f5dd6c66cd3fbcf451f574dec9313', '2026-10-31T14:35:07.258231+00:00'),
  ('0cf4721d-e8b4-5011-b46e-083c0a962135', 'Tantie Alice', 5.30578, -3.98209, 5.30578, -3.98209, false, false, 'https://www.tripadvisor.fr/Restaurant_Review-g297513-d12934350-Reviews-Chez_Tantie_Alice-Abidjan_Lagunes_Region.html', '6a3a2c0f843808a029535f692fd975c42941e7876d1f6a39b0e78ecbf8855ce4', '2026-10-31T14:35:18.577296+00:00'),
  ('0d07d457-dd07-5be5-b995-f5ae0e38b78e', 'Chez Emma', 5.439561, -4.008983, 5.439561, -4.008983, false, false, 'https://app.chicmenu.io/c/CH29081319/menu', '0c127fae4687d917f6d0b32c92d7dae8fffb36dc69684a9ddcab7ec9a3c13a05', '2026-10-31T14:35:08.845533+00:00'),
  ('0f3d954b-4dc9-5d0b-8233-db74823251af', 'Akouyê', 5.339722, -3.977144, 5.339722, -3.977144, false, false, 'https://app.chicmenu.io/c/AK29091350/menu', '31b862bacf125540b3767e42e16aae20d88f78fa339fe3f5bf47db7884784a4b', '2026-10-31T14:34:47.790146+00:00'),
  ('149d62e2-6474-5934-a88d-ce39c9394e8c', 'Bouffivoire', 5.303514, -3.949641, 5.303514, -3.949641, false, false, 'https://app.chicmenu.io/c/BO1209124830/menu', 'a2f1ddd50a027ddde4e1269034034b18382a29d4fca47e339a1e9d54af5f6e53', '2026-10-31T14:34:57.473187+00:00'),
  ('14ce5824-7043-5c6e-a0cd-90a9e2eef793', 'Copa d’Ella', 5.362247, -3.997724, 5.362247, -3.997724, false, false, 'https://app.chicmenu.io/c/CO1409124916/menu', 'f9e99489c1c381ff167d0b0ebee0c43f4e33c55375ef45d0d12beaaea8511e39', '2026-10-31T14:35:12.092140+00:00'),
  ('18840756-a6f2-5fef-a881-e3e930f2b063', 'Chez Salma', 5.310774, -3.9919127, 5.310774, -3.9919127, false, false, 'https://patisseriechezsalm.wixsite.com/chez-salma', '6a0c983f4212b4bab5ecb06909d9f7e0be997f7bccada8853b7869ee1f571231', '2026-10-31T14:35:17.697732+00:00'),
  ('1a494da7-c134-58fe-a88f-ddc39572c237', 'Parenthèse', 5.276573, -3.969543, 5.276573, -3.969543, false, false, 'https://www.tripadvisor.fr/Restaurant_Review-g297513-d17456504-Reviews-Parenthese-Abidjan_Lagunes_Region.html', '229720ef77761197fd42d481c100c6f446806fd5c084643eb03b623ba808e707', '2026-10-31T14:35:18.637614+00:00'),
  ('1aecfec8-1063-54c5-b02f-c8f971895472', 'Babi Chill', 5.385959, -3.968793, 5.385959, -3.968793, false, false, 'https://app.chicmenu.io/c/BA02081814/menu', 'd41ae36ea2cf08d30715303d8a318fbc6b3b1f4207f86d035c1cced75b78c0fd', '2026-10-31T14:34:53.045224+00:00'),
  ('1c1a243b-5c7b-572b-9787-fd9e68bd8221', 'Jay’s Meat & Seafood', 5.2855451, -3.9768553, 5.2855451, -3.9768553, false, false, 'https://www.sikaplaces.com/restaurants/jays-meat-et-seafood-zone-4-zone-4-marcory-abidjan/64195', '78c54f663e316615486b125ddc22021ccf77fb6c423f6d74ca32b587892110c9', '2026-10-31T14:35:17.859324+00:00'),
  ('1c20c788-b0bf-5178-8c8d-e9f002184ac2', 'Cherry & Blossom', 5.378081, -3.969992, 5.378081, -3.969992, false, false, 'https://app.chicmenu.io/c/CH1409003033/menu', '7b66524524fcf64e532fbb16dd8b08cec8068c4056607281f360e2b948f1bbc0', '2026-10-31T14:35:02.206242+00:00'),
  ('1f0458f8-a1f9-5f9a-be35-d9107074cf4d', 'Chill Out', 5.367286, -3.969826, 5.367286, -3.969826, false, false, 'https://app.chicmenu.io/c/CH05081902/menu', 'aa43eecb92c8ca6e4d5711f387c35e91b54859558008b1342e30005c801f47da', '2026-10-31T14:35:01.121168+00:00'),
  ('20d11819-93d2-5a65-9f6f-050b6040b372', 'Chez Hélène', 5.39755, -3.945525, 5.39755, -3.945525, false, false, 'https://www.tripadvisor.fr/Restaurant_Review-g17512259-d25459972-Reviews-Chez_helene_restaurant-Cocody_Abidjan_Lagunes_Region.html', '50ba54baf760254d89c77a267cf8be1c4ccde0965e09bda479c112749f1b3776', '2026-10-31T14:35:18.245470+00:00'),
  ('23f7d77e-647b-53bf-bb4f-c765aec7078f', 'BGA Restaurant', 5.354, -3.970258, 5.354, -3.970258, false, false, 'https://app.chicmenu.io/c/BG11091435/menu', '7d2feda8841363887e13220b6a603d253122d97fd402066c139e6bd0a2cae6b6', '2026-10-31T14:34:53.715897+00:00'),
  ('2456a1ce-8937-5c75-aa5d-c74a9fe67b59', 'Afen’y', 5.379337, -3.990981, 5.379337, -3.990981, false, false, 'https://app.chicmenu.io/c/AF09091322/menu', '9b5a71aed1d40af78e5ed036a97b16e80f1f5d10be28f6a5e2fb747803a6d419', '2026-10-31T14:34:45.719230+00:00'),
  ('24aa8a43-ae29-58a1-83df-f54c289b2c0b', 'BASE lounge Bar & Food', 5.283172, -3.969778, 5.283172, -3.969778, false, false, 'https://app.chicmenu.io/c/BA11091435/menu', '461787c1354d73369d066ed4e408ce6de7440d57e0cad938f7bc77894005176f', '2026-10-31T14:34:53.451786+00:00'),
  ('27b22c77-ee4c-54a4-9d01-8c5a410526b1', 'Coquelicot Abidjan', 5.362099, -3.971486, 5.362099, -3.971486, false, false, 'https://app.chicmenu.io/c/CO1409124920/menu', '407730dd34e7a8bd5757005458f4c86b376d4d97b9d858e95dd84b00eecc98c1', '2026-10-31T14:35:12.382873+00:00'),
  ('29ec8492-d11d-5981-ab71-eddab607d371', 'Annapurna restaurant', 5.287864, -3.973785, 5.287864, -3.973785, false, false, 'https://app.chicmenu.io/c/AN29081322/menu', '0d65b27f0dc6e2b27a321ef9af8fdd2e7733f5afbe03570c095f890ecca0b473', '2026-10-31T14:34:49.567555+00:00'),
  ('2c2d7620-4023-51fd-bada-bba1f08fca70', 'Chez Pichi', 5.280969, -3.978168, 5.280969, -3.978168, false, false, 'https://app.chicmenu.io/c/CH26081019/menu', '9351aa790ea45fc23fc10029c942534e7e9104fd8962331efd28e3070d7674f9', '2026-10-31T14:35:08.680331+00:00'),
  ('2c4d0c79-7a0c-52b8-b4dc-47eeddb01b0c', 'Chef Manu Do', 5.38525, -3.912396, 5.38525, -3.912396, false, false, 'https://app.chicmenu.io/c/CH02091313/menu', '474fc51271bc275826c7af0bb588880ebfb2fa3061ec8c7a25e0ecf5083b8fd1', '2026-10-31T14:35:00.472126+00:00'),
  ('2d5bf930-b437-5a8f-90d1-c89d514be0f1', 'Atchancy', 5.378006, -3.969929, 5.378006, -3.969929, false, false, 'https://app.chicmenu.io/c/AT11091434/menu', '99033b7fe6e2ba285f50f46d55a305040249a34e02d024ba54dd82ec5a656dc5', '2026-10-31T14:34:51.610833+00:00'),
  ('2d6018a2-e23b-55d0-ac86-cf3095af3ecf', 'Complexe Palais d’Afrique', 5.3255, -3.932127, 5.3255, -3.932127, false, false, 'https://app.chicmenu.io/c/CO14091249/menu', '09e6de240979d0d25e3046babd38f9587751c6886da8c44f03320871b5f3235f', '2026-10-31T14:35:10.485939+00:00'),
  ('2d6a6f61-e689-5968-853e-23aa0dbab08c', 'Chez Arno', 5.285425, -3.976414, 5.285425, -3.976414, false, false, 'https://app.chicmenu.io/c/CH21082013/menu', '1fa9b78e49ba9e2626316ec70c57f1b297a4f89b9f45bb5aed2f2f77b8214764', '2026-10-31T14:35:07.153517+00:00'),
  ('2e8c1449-06c8-5279-9262-f22566b2a075', 'Au Petit Bouddha', 5.287013, -3.979391, 5.287013, -3.979391, false, false, 'https://app.chicmenu.io/c/AU11091434/menu', 'ae39a429da40a2bb384d1c25ca7d12cb322bc0e1e037906a6c606523ed90f528', '2026-10-31T14:34:51.777868+00:00'),
  ('2f9f686e-90f4-5a8e-85f8-ae025e87d7e6', 'Bissa', 5.364153, -3.992646, 5.364153, -3.992646, false, false, 'https://app.chicmenu.io/c/BI1309120137/menu', 'bdfb5f7f8df03005c1506ee9b6bcd52ecd50e618c3c070835d41e9701d53e9e0', '2026-10-31T14:34:55.413437+00:00'),
  ('34903c02-2df7-5b92-9934-9a73c24f29fa', 'Chez Arthur', 5.325473, -3.936267, 5.325473, -3.936267, false, false, 'https://app.chicmenu.io/c/CH17082110/menu', 'd150c2390abd0b18bf9a953dd15e434d81e508294c42986d00c780cbcf347faf', '2026-10-31T14:35:06.822412+00:00'),
  ('3e6985d9-e488-5e3b-9a46-b1828fffd6cf', 'Cosi', 5.359593, -3.962411, 5.359593, -3.962411, false, false, 'https://app.chicmenu.io/c/CO1409124932/menu', '3cd074341069ce1480398631e4ca2f6731647284dc5590e6984c81cadd6d209b', '2026-10-31T14:35:12.641704+00:00'),
  ('43a37e2c-65de-51d0-b5f4-31b11fcdede3', 'Coup de food', 5.297779, -3.988112, 5.297779, -3.988112, false, false, 'https://app.chicmenu.io/c/CO1409124941/menu', '697f5d11e73e63ef1474874db3079736730e27ea4ee5fb8b1dd3a45c3ca5c754', '2026-10-31T14:35:12.843340+00:00'),
  ('4d96b18a-d8fb-56b9-86f7-2481b89e0aa6', 'Agapé Restaurant', 5.343859, -3.921625, 5.343859, -3.921625, false, false, 'https://app.chicmenu.io/c/AG0909132155/menu', 'e6f532cf074a6c3e4d0ecdef06f1df1da590131b7635b5f9715d60213be764a8', '2026-10-31T14:34:47.682717+00:00'),
  ('4dc9d678-ebf7-5dbc-a830-ae53949fcc98', 'BLUE IN Restaurant', 5.350129, -3.978134, 5.350129, -3.978134, false, false, 'https://app.chicmenu.io/c/BL04081633/menu', 'cb8a1c5a55fa55557d8bdb864581cade1b30dc129bdc9aeeae65084952a8c60f', '2026-10-31T14:34:55.709050+00:00'),
  ('5125d0e1-0204-545e-bb23-87c4383d2f7d', 'Chefs & Gastronomie', 5.381819, -3.966422, 5.381819, -3.966422, false, false, 'https://app.chicmenu.io/c/CH1409003029/menu', 'b9815e8aa5a740c22edcbc30fbde6b591f21b27e0a37f6f0da04a184d1d407b4', '2026-10-31T14:35:02.033157+00:00'),
  ('52b02882-ea4c-5b9b-8ebd-679f038c9603', 'La Maison Akissi', 5.351799, -3.992546, 5.351799, -3.992546, false, false, 'https://app.chicmenu.io/c/LA05081252/menu', 'c283451909205581c0414c9b068f901748050ab52eb4540aacce4fea978d6ccf', '2026-10-31T14:35:15.755434+00:00'),
  ('5759c690-7132-5e0c-afe2-85d1c7244571', 'Bouatikro', 5.490427, -3.943351, 5.490427, -3.943351, false, false, 'https://app.chicmenu.io/c/BO1209124826/menu', '46458bd95815875ef557efdd49945f90d04fb5bb7a7b8fd262e9d9492bba7caa', '2026-10-31T14:34:57.439336+00:00'),
  ('5d89c667-c7d9-5524-93a7-036969583847', 'Adoumin Beach Resort', 5.321618, -4.001824, 5.321618, -4.001824, false, false, 'https://app.chicmenu.io/c/AD08081038/menu', '4f0bb134fa423c36a6c13655dbb917f05e388cb8608e5018f61d535426f98614', '2026-10-31T14:34:45.718623+00:00'),
  ('5dd1ee8e-0d5c-5dd5-8be1-ef006155a501', 'Chez Ambroise', 5.30221, -3.98946, 5.30221, -3.98946, false, false, 'https://app.chicmenu.io/c/CH1409003046/menu', 'edc9ba7422daf4d8150f46e783994ee08120f48b5b788c67238ebd0e20d4ab0c', '2026-10-31T14:35:03.280346+00:00'),
  ('5f79ba8f-8dbf-5288-85a3-2a5a602d997d', 'Cacao Lounge', 5.327097, -4.004801, 5.327097, -4.004801, false, false, 'https://app.chicmenu.io/c/CA12091248/menu', '4010861c9a8908d95b89bf766b098c8d32bc5d5cfbf288bed046be0a1a3982dd', '2026-10-31T14:34:59.713200+00:00'),
  ('5fc3912f-d79a-5b6c-b263-2bfbaf2d820e', 'Restaurant villa le prisé', 5.273849, -3.978969, 5.273849, -3.978969, false, false, 'https://app.chicmenu.io/c/LE03051409/menu', 'b576a1a0399359fb2d34a0a62c17757a02d24aebd29c71a7a105f3179482e1f6', '2026-10-31T14:35:15.900435+00:00'),
  ('61be9ce5-7aad-573d-8c7b-23b2c4119714', 'CASA ÈKWA', 5.341961, -3.999273, 5.341961, -3.999273, false, false, 'https://app.chicmenu.io/c/CA04081140/menu', 'a068539e12047ba56256127e5cc1451b6b3a11b7110190a72195ff7631e9cd54', '2026-10-31T14:34:59.087627+00:00'),
  ('6219ade1-9371-5526-9a62-cd226f82ed1d', 'Cova Abidjan', 5.401682, -3.960965, 5.401682, -3.960965, false, false, 'https://app.chicmenu.io/c/CO1409124949/menu', '8feb0746f24baf744417a9d4cb4c6afaa686526bca00eb12d665864b7108aa98', '2026-10-31T14:35:13.902585+00:00'),
  ('665326ba-3c52-51a5-aaf1-caf466caf4ad', 'Chez Laure', 5.332514, -3.936334, 5.332514, -3.936334, false, false, 'https://app.chicmenu.io/c/CH1409120055/menu', '524b8fa3a28c0f4a397d6bd8ac922f73e47dd203631de9f10f4a936f7777f374', '2026-10-31T14:35:05.483617+00:00'),
  ('68a4aa83-ca13-54d2-80d8-c548b2bb5b85', 'Chez Jb resto – lounge', 5.325486, -3.937889, 5.325486, -3.937889, false, false, 'https://app.chicmenu.io/c/CH1409120042/menu', '341449c11cd8049c1edac3ea6d1b85e6c9d98a6a52010deb00364e65c179646c', '2026-10-31T14:35:05.057555+00:00'),
  ('702d29d0-3fd6-502d-9f0f-8f0ff6175ba8', 'Le Montmorency', 5.3167, -4.0667, 5.3415041, -4.0773175, true, false, 'https://lemontmorency.ci/', '28e0529997b141af1ae898046d64b6606a31e45a2d307e01f7d57beeda90c651', '2026-10-31T14:35:17.555181+00:00'),
  ('743beb33-38ec-5c7c-9afe-3b2e6959a7fe', '912 Restaurant Lounge', 5.387219, -3.986249, 5.387219, -3.986249, false, false, 'https://app.chicmenu.io/c/RE09091321/menu', 'b070dd45b9ee705b103af3693b1164b24d6e78abae1d28e2e5c91767e6b8d134', '2026-10-31T14:35:16.601640+00:00'),
  ('74651822-c594-5004-9072-fc3cb44cea12', 'Brasserie l’Endroit', 5.32175, -4.017304, 5.32175, -4.017304, false, false, 'https://app.chicmenu.io/c/BR12091248/menu', 'db5d7234eed15e871c839733785bcb10f7024b18b87bac34ea88cb8524d8e743', '2026-10-31T14:34:57.782345+00:00'),
  ('7513d31e-0688-5fc1-b77f-1e66aaf92fef', '14 Lounge Terrasse', 5.292021, -3.973629, 5.292021, -3.973629, false, false, 'https://app.chicmenu.io/c/LO09091321/menu', '63c594a903f2a3c411ea9797ab74d7a942c73705677fe2d411e1fe4ce46f2346', '2026-10-31T14:35:16.373287+00:00'),
  ('7825e4d4-5331-5aa2-ab77-80eb3780877c', 'Aphro Restaurant', 5.32538, -3.936217, 5.32538, -3.936217, false, false, 'https://app.chicmenu.io/c/AP10091532/menu', '3156d36ed764113f637b44c35f5ae58e3c35632a4103a990131bd1d2bb9f1d4b', '2026-10-31T14:34:49.588099+00:00'),
  ('7954f9ad-792e-5998-8ec0-420c1cc2feb1', 'Africafé — Ivoire Trade Center', 5.326941, -4.00206, 5.326941, -4.00206, false, false, 'https://app.chicmenu.io/c/AF23041219/menu', 'd13a6f27485605b4f8afa6ffb595f7152d2eb37d2663772f10f5bf281f664936', '2026-10-31T14:34:47.669991+00:00'),
  ('7b3dc000-841b-50f8-881b-a09626a7287c', 'Crabe Braisé Solférino', 5.344853, -3.998458, 5.344853, -3.998458, false, false, 'https://app.chicmenu.io/c/CR14091249/menu', 'd8cd44ac077b32a640209ee6c8dbd701a086004c4bd3063b4b6bd4a1af87a354', '2026-10-31T14:35:14.278716+00:00'),
  ('7b74e069-90e5-5059-b725-8127d4975672', 'Antik Restaurant', 5.380201, -3.975543, 5.380201, -3.975543, false, false, 'https://app.chicmenu.io/c/AN08081150/menu', 'd06dcbe63d2a757d7a6c445bb8950ad22320d364a70de19498b83d29ef6e627a', '2026-10-31T14:34:49.520407+00:00'),
  ('7c45fa19-85a3-5251-92b4-02398d8f840c', 'Casa Mexicana', 5.287394, -3.979797, 5.287394, -3.979797, false, false, 'https://app.chicmenu.io/c/CA14090030/menu', '8768c0b47a325d4da12d802d7fea4430cce71fe836021c5fce8375ececd3e7f4', '2026-10-31T14:34:59.773156+00:00'),
  ('7f342de4-6298-5633-9c57-355fe33eed67', 'Chez Ben', 5.383784, -3.968503, 5.383784, -3.968503, false, false, 'https://app.chicmenu.io/c/CH1409003059/menu', '8513e9d22b49a4e4ec3aa00bb690f6a97fa852e4e329cc17a3483675462d401d', '2026-10-31T14:35:03.925431+00:00'),
  ('85934011-71da-5f45-a69f-26fbfd1d66ff', 'Barbecue House', 5.386051, -3.928549, 5.386051, -3.928549, false, false, 'https://app.chicmenu.io/c/BA05081232/menu', '184c2fad96f3e1b962af75eb53eab8d72b54a178601031e49c7b97b8f6d6491f', '2026-10-31T14:34:53.362961+00:00'),
  ('8b8651bd-8fa8-50f5-91ad-29a3b5c9536e', 'Le Kampement', 5.29100975036707, -3.97865926931584, 5.291009750367067, -3.978659269315844, false, true, 'https://www.sikaplaces.com/restaurants/le-kampement-zone-4-marcory-abidjan/8163', '0b2c75c400dc2a759993a44a3983606777660ed2b40999cebc7f3993a0926733', '2026-10-31T14:35:17.977335+00:00'),
  ('8e6a7b78-558b-57d0-a109-f9d49b3f13e4', 'Chez François Bingerville', 5.361762, -3.885875, 5.361762, -3.885875, false, false, 'https://app.chicmenu.io/c/CH27080925/menu', '85a3d153eadd49909b1bf7133ce4958059d57960f83931268d6c4ae6b7044916', '2026-10-31T14:35:08.727530+00:00'),
  ('90586a0a-1bec-599d-97ca-ef8d18951bb2', 'Le Grand Large', 5.288571, -3.988458, 5.288571, -3.988458, false, false, 'https://app.chicmenu.io/c/LE05081307/menu', '36aad2ab3cfa8d30d015516435dd46d8750881d6cb0657b49a633d1c8898bf83', '2026-10-31T14:35:16.193161+00:00'),
  ('90ef1fd4-ba86-5224-83cd-62e707bbdc66', 'Chez Richard''s', 5.295409, -3.987762, 5.295409, -3.987762, false, false, 'https://app.chicmenu.io/c/CH31071710/menu', 'a67413a24f5f68e81474facb096086faa4b2b1f2730dff2596bf2f7ebbb1bca1', '2026-10-31T14:35:08.885234+00:00'),
  ('92f343c0-8592-5583-837c-7c3d7ebd5ed1', 'Bin’s', 5.345523, -4.095216, 5.345523, -4.095216, false, false, 'https://app.chicmenu.io/c/BI1209111729/menu', '37dd2456fefdbbb5fc27329cecc44f7b3cd2a701c33e3dc3b9378532d56e7956', '2026-10-31T14:34:55.303824+00:00'),
  ('95273e23-87c1-5c42-aad3-2211f8e461d0', 'Brasserie du Parc', 5.322805, -4.019496, 5.322805, -4.019496, false, false, 'https://app.chicmenu.io/c/BR05090852/menu', 'c76b4923400281748d0846faf0e986c00618856af0b8d8655e33305eaaf47998', '2026-10-31T14:34:57.687647+00:00'),
  ('9d54bcb5-b581-564f-bc31-b2cf597197c8', 'Chez Hao', 5.283084, -3.981285, 5.288414, -3.976364, true, false, 'https://app.chicmenu.io/c/CH14091200/menu', '374ac269342cca6e927f1af46231c4c6ceea233bd227890c38a6f878c69c3ffc', '2026-10-31T14:35:05.056785+00:00'),
  ('9d5aed7e-2543-5ba8-aa7c-03a71f9f005f', 'Biootifood garden beach', 5.328966, -3.930886, 5.328966, -3.930886, false, false, 'https://app.chicmenu.io/c/BI1209111733/menu', '43726ec9de671969abe1ab0bfcca594d13d785e2def258569fb09d9840671ad6', '2026-10-31T14:34:55.354387+00:00'),
  ('a1001c86-4e11-5b80-a3e0-f0702c33954b', 'Blue 8 Lounge', 5.376988, -3.994002, 5.376988, -3.994002, false, false, 'https://app.chicmenu.io/c/BL1309120146/menu', 'b57b8fe83afa2ef1a4aba33d72cf2691321bb4f61d10a9d2878c90142fe1f963', '2026-10-31T14:34:57.373123+00:00'),
  ('a47d5ade-dac3-517b-ad0b-2f8de92e3744', 'Billard VIP', 5.374956, -3.996253, 5.374956, -3.996253, false, false, 'https://app.chicmenu.io/c/BI1209111721/menu', '3084f886605d4b08755c629c3dfa0439887ceac5e34694aa9cd67bf400b08245', '2026-10-31T14:34:55.293861+00:00'),
  ('a49417d3-ef8e-5b18-a1fa-62c694cae891', 'La Villa Di Sorrento', 5.288319, -3.987753, 5.288319, -3.987753, false, false, 'https://app.chicmenu.io/c/LA31071555/menu', '9eb33154e49789154ee01e321b320d7e5847c3dc985d77aa18222cb35aaaa7fd', '2026-10-31T14:35:15.793641+00:00'),
  ('a812cc96-1afe-5d77-ac11-09fce6910b89', 'Chez Ama Sawa', 5.304079, -4.013173, 5.304079, -4.013173, false, false, 'https://app.chicmenu.io/c/CH1409003042/menu', '32f840a67d2877e3bf2fa7a23770f5b05dbed96c7e436fe3a94d471c3319aa7e', '2026-10-31T14:35:03.093406+00:00'),
  ('ae82f2ac-eedb-57f1-afdd-a6406aa4b0a4', 'Chez Christha', 5.287935, -3.980906, 5.287935, -3.980906, false, false, 'https://app.chicmenu.io/c/CH14090031/menu', 'c96bb248341c88c9c68db304f212925f5f8992122665ae801931301cb05cfa34', '2026-10-31T14:35:04.065194+00:00'),
  ('afbcee61-db2a-53e4-9953-e450d6597640', 'Amounah', 5.291528, -3.982031, 5.291528, -3.982031, false, false, 'https://app.chicmenu.io/c/AM1009153216/menu', 'e14dec87e8258169817f078d1f52a03835fff0126c9593ef69035930fc591e27', '2026-10-31T14:34:49.360897+00:00'),
  ('b03cdb35-637f-54b5-9a10-dc5c055507b1', 'Arirang Restaurant', 5.277739, -3.972275, 5.277739, -3.972275, false, false, 'https://app.chicmenu.io/c/AR16090848/menu', 'd738b2d820ac5f94f39733b00dd234b423c7853aaab894f60f8713f3f7cd92fe', '2026-10-31T14:34:49.608905+00:00'),
  ('b1aab416-9c99-5bdf-a27c-12f679f1e186', 'Coco Lounge', 5.369936, -3.95437, 5.369936, -3.95437, false, false, 'https://app.chicmenu.io/c/CO1409120207/menu', 'a5dcc98bd2df43dd01865801bfa8e924e3342ad280409d7ed3b9a080edaf9ee9', '2026-10-31T14:35:09.679547+00:00'),
  ('b381d082-7e0c-5416-8b1b-26660208f466', 'Abidjan Village', 5.363468, -3.958145, 5.363468, -3.958145, false, false, 'https://app.chicmenu.io/c/AB09091321/menu', 'aaefbbb30700b44e054b41568bdfeeff93d9382336df7f739b2e2d6d1b43ac78', '2026-10-31T14:34:45.716692+00:00'),
  ('b5e5387e-48e1-59fc-b4e0-ee3bc75639a1', 'Cour Royale', 5.378354, -3.973721, 5.378354, -3.973721, false, false, 'https://app.chicmenu.io/c/CO1409124945/menu', 'd86fdd6bcd6634bfff167c80b5185f8ea182862c47f3a0a79fa9c73528975624', '2026-10-31T14:35:13.817703+00:00'),
  ('b7745277-1622-53ff-88ef-05469809cb70', 'Chawarma Adams', 5.35021, -3.976069, 5.35021, -3.976069, false, false, 'https://app.chicmenu.io/c/CH1409003025/menu', '4aefb58a95957296e8de53f9f2aa00cb844beb0ae83b2693e0f2241ba9708f8a', '2026-10-31T14:35:01.562309+00:00'),
  ('b96b60b0-a53f-5953-b422-ec5c63c4adc0', 'Chez Georges', 5.319867, -4.011589, 5.319867, -4.011589, false, false, 'https://app.chicmenu.io/c/CH21081942/menu', '72805bf2039fc04919349b58080cfae19f935092996c6cf3ee8cb16fbe2ec6fa', '2026-10-31T14:35:06.947311+00:00'),
  ('be782ab2-28c3-59f7-99e9-b4083e58621d', 'Comanche Diner', 5.400565, -3.977858, 5.400565, -3.977858, false, false, 'https://app.chicmenu.io/c/CO21081534/menu', 'ad224e07d1d733319f16842f566619cbc2d9a2d943666f59c55bf7447df3e323', '2026-10-31T14:35:13.917130+00:00'),
  ('c2e487ab-c65a-5ce5-a45d-3882f2a9f545', 'La Croisette', 5.3228, -4.0164, 5.3228, -4.0164, false, false, 'https://croisetteabidjan.com/', 'aad4ec0d999cab0665c953523a86c77cb6d280b067c934c155e34db5733275c8', '2026-10-31T14:35:17.307349+00:00'),
  ('c3bd7b5d-fbfb-5b7f-a642-e2a808e08211', 'Bien Manger avec CT', 5.413221, -3.968478, 5.413221, -3.968478, false, false, 'https://app.chicmenu.io/c/BI12091117/menu', 'f8cdeca96deb7cea870fb71e5ba580bcbbe3d4872c5e5c6668dd3f67ce787b72', '2026-10-31T14:34:54.206266+00:00'),
  ('c5acfd12-01dd-5cd3-9beb-0531d89c3e99', 'IN’ Concept Store', 5.36476, -3.99732, 5.36476, -3.99732, false, false, 'https://www.tripadvisor.fr/Restaurant_Review-g297513-d27114793-Reviews-In_Concept_Store-Abidjan_Lagunes_Region.html', '37288ac762762f9aad76adb146d15351294341343c5bf716416de5dda0fdb02c', '2026-10-31T14:35:18.694307+00:00'),
  ('cba14954-5f18-5fc4-b3ff-95b5741a6276', 'BBQ 225', 5.395119, -3.987373, 5.395119, -3.987373, false, false, 'https://app.chicmenu.io/c/BB11091435/menu', '27270f00f8d7cc68dcd1f7ab213dabce742753c4477d113bfa66a0038db12fc9', '2026-10-31T14:34:53.690739+00:00'),
  ('ce35a771-c9ca-5b46-a6f1-61c9144646f0', 'Clay', 5.282679, -3.984356, 5.282679, -3.984356, false, false, 'https://app.chicmenu.io/c/CL14091201/menu', '15fbabeeb5bc5fbe70752c4c711d08a0139c8f4860ef0f143c44ac7b890c6615', '2026-10-31T14:35:08.937200+00:00'),
  ('ce515d2b-8e79-52b9-b33c-75f73b8f7956', 'Abou Afif', 5.298486, -3.988825, 5.298486, -3.988825, false, false, 'https://app.chicmenu.io/c/AB0909132159/menu', 'f96763489b95ebd61fa0e5a40d174f3a3a6c2e1a7ef6549e7b141a311b05f37d', '2026-10-31T14:34:45.717720+00:00'),
  ('cf2e78d1-df2b-55a8-b3fc-1f7fc645595c', 'Africafé — Plateau', 5.321947, -4.018726, 5.321947, -4.018726, false, false, 'https://app.chicmenu.io/c/AF15042053/menu', '4d93e4bf1243ef3e6c8feb69a06700aac5c6ba5056c40c0db7704d8121718c0c', '2026-10-31T14:34:47.586617+00:00'),
  ('d0c895dc-5fb0-5631-ad35-10c7806157d4', 'Combi Lounge Club', 5.364202, -3.959839, 5.364202, -3.959839, false, false, 'https://app.chicmenu.io/c/CO1409120219/menu', 'a696ed1167c632880fab35dd483f942ece2e20ea04a62be124ec32839860017e', '2026-10-31T14:35:10.367664+00:00'),
  ('d4438e81-eaac-5e64-8daa-108b57b60b66', 'Point Barre', 5.3184723, -4.0156269, 5.3184723, -4.0156269, false, false, 'https://www.pointbarreabidjan.com/', '2294f31ee46546e7f79480eb287d1de5b2f231b80a09b416e3294dbc7c4bafa1', '2026-10-31T14:35:17.839173+00:00'),
  ('dc5a5033-48c2-580e-bdc8-bd028b0e9688', 'Complexe hôtelier O’bord', 5.310052, -3.819948, 5.310052, -3.819948, false, false, 'https://app.chicmenu.io/c/CO1409124907/menu', 'fddc9b80a27308591d2eabf19a0481f752731abb43ef94df09dab53d27a8abc0', '2026-10-31T14:35:10.966222+00:00'),
  ('dd0e38cd-189f-5b2a-b524-5779a76027c3', 'Calla Abidjan', 5.301373, -3.990343, 5.301373, -3.990343, false, false, 'https://app.chicmenu.io/c/CA10081657/menu', '5a18118ac9ce95a5be01eb1a0bd90924060fc5874144e6915798563d9d400583', '2026-10-31T14:34:59.150562+00:00'),
  ('e1064325-6a48-5ffe-a8a9-99534da2ba51', 'Ayôfè Chez Lys', 5.370362, -3.956484, 5.370362, -3.956484, false, false, 'https://app.chicmenu.io/c/AY11091435/menu', 'dcab95a75ca69fe2f1ac162269af0ed168e5f3d0a39c33db5a338499b0e1f58a', '2026-10-31T14:34:51.804384+00:00'),
  ('e2ffcbb5-9e6d-5517-afd9-c06dc8191ba3', 'A Tavola', 5.321875, -4.017176, 5.321875, -4.017176, false, false, 'https://app.chicmenu.io/c/AT09091036/menu', 'd2b1c994e6bb5a47b67c43c791ad8d503eefdf06c05c66cba4d57ac319c013fb', '2026-10-31T14:34:51.510421+00:00'),
  ('ea63bf3f-4a62-5546-bc12-10ed18ad85cd', 'Cohiba’r Club', 5.338444, -3.997888, 5.338444, -3.997888, false, false, 'https://app.chicmenu.io/c/CO1409120215/menu', '59e0006846668cbd24420721ffa48d0a8eee1c99d04f0c808986cfaf8b9869bb', '2026-10-31T14:35:10.300922+00:00'),
  ('ea847ee8-d731-53d2-9ff7-fae920b4af3f', 'Cook Africa', 5.389351, -3.98542, 5.389351, -3.98542, false, false, 'https://app.chicmenu.io/c/CO1409124912/menu', 'c054efb9dedd30b89342576811cc7c3c4cbb2078d26cbfee53c9f40faf918205', '2026-10-31T14:35:11.341028+00:00'),
  ('ed6bfec3-278d-5c45-b506-a7cdb7f761d4', 'Azalaï Hôtel Abidjan', 5.2992255, -3.9864996, 5.2992255, -3.9864996, false, false, 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3972.7656242986823!2d-3.9890798898996107!3d5.299225494656877!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfc1ec1d62c80d57%3A0x2655ab1ff22bb0da!2sAZALA%C3%8F%20HOTEL%20ABIDJAN!5e0!3m2!1sfr!2sci!4v1736509180886!5m2!1sfr!2sci', '261af1ada4015266c0bc49b81d50d7a9ebc46049f1b26abd595273c84a3dbe0e', '2026-10-31T14:38:13.679960+00:00'),
  ('eee4a392-8b24-5c94-96c8-c4686a32d71e', 'Casa Baobab', 5.284866, -3.97517, 5.284866, -3.97517, false, false, 'https://app.chicmenu.io/c/CA30071948/menu', 'c1859f6f8a93a37b314a37c5300b917e1a7b9e28636266719b7321bf5048f2fc', '2026-10-31T14:35:00.191097+00:00'),
  ('efa7a008-4b1c-5f8a-8700-6a9c89e0e3d4', '492 Garden Lounge', 5.358605, -3.950801, 5.358605, -3.950801, false, false, 'https://app.chicmenu.io/c/GA09091321/menu', 'f4289b86fc2537dd357c64859aaceed4efb7f499ddcfa8bb44117449b3e573a4', '2026-10-31T14:35:14.448578+00:00'),
  ('f2e3aff3-ad33-50d5-a489-11a04a1ca978', 'Corniche', 5.27768, -3.98203, 5.27768, -3.98203, false, false, 'https://app.chicmenu.io/c/CO1409124928/menu', 'edd3d6577c28afe849ce5060eb4182cd9d845f97c457dfee407e4fdda6fe8c30', '2026-10-31T14:35:12.392341+00:00'),
  ('f617cc2d-8951-5482-956b-75220e56553b', 'Blue Lounge', 5.393719, -3.978797, 5.393719, -3.978797, false, false, 'https://app.chicmenu.io/c/BL12091117/menu', '20a2a8dc24b67841dc0bf4e9c8942daf1951fc6a53736a631fc61aa67eb11fb9', '2026-10-31T14:34:57.030916+00:00'),
  ('fbf6e07a-4a15-5b5b-b068-a16458d37dba', 'Atmosphere Abidjan', 5.284082, -3.984656, 5.284082, -3.984656, false, false, 'https://app.chicmenu.io/c/AT03081110/menu', '6cd26c4dc3abc161501d867b13372fd3de8a2979424723f255ebef3a707ecfa5', '2026-10-31T14:34:51.492487+00:00'),
  ('fc5fb87c-af69-5c42-86de-2c3b607e6e38', 'Chez Jo', 5.363915, -3.926536, 5.363915, -3.926536, false, false, 'https://app.chicmenu.io/c/CH1409120050/menu', 'b11bf0323f3e1b87cf9f2bff4cf6ed5180a23a181bc3471bde1437188e35d9eb', '2026-10-31T14:35:05.168985+00:00'),
  ('fcf53a29-7c83-5f10-861d-658d3a7c52af', 'Chez Anita', 5.394983, -3.986167, 5.394983, -3.986167, false, false, 'https://app.chicmenu.io/c/CH1409003055/menu', 'cd428b67a73654bf0ffdc34328be292d2d27e8b626d72b8cfa3c25ec6d53c499', '2026-10-31T14:35:03.557651+00:00'),
  ('ff1cd1e9-da6b-57ba-bfe3-d96fcd89b097', 'Chap Chap Express', 5.349585, -3.954596, 5.349585, -3.954596, false, false, 'https://app.chicmenu.io/c/CH14090030/menu', '2af8dc3e5c51dca71b1eb63e7ac738f3c5be9764a92b0419ba873ff3de0549c4', '2026-10-31T14:35:01.198755+00:00');

CREATE OR REPLACE FUNCTION pg_temp.apply_guet_cartography_20261031()
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  batch_id constant text := 'guet-cartographic-locations-2026-10-31';
  batch_version constant integer := 1;
  source_audit_sha256 constant text := 'dfb685ba575caec895179b270768b9deb32ecc86dad5ac4f4fe14a3042625417';
  validated_at timestamptz := clock_timestamp();
  corrected_count integer; inserted_count integer; eligible_count integer;
BEGIN
  IF (SELECT count(*) FROM pg_temp.guet_cartography_targets_20261031)<>100
    OR (SELECT count(*) FROM pg_temp.guet_cartography_targets_20261031 WHERE correct_coordinates)<>2
    OR EXISTS(SELECT 1 FROM pg_temp.guet_cartography_targets_20261031
      WHERE correct_coordinates AND place_id NOT IN (
        '9d54bcb5-b581-564f-bc31-b2cf597197c8','702d29d0-3fd6-502d-9f0f-8f0ff6175ba8'))
    OR EXISTS(SELECT 1 FROM pg_temp.guet_cartography_targets_20261031
      WHERE serialized_float_tolerance AND place_id<>'8b8651bd-8fa8-50f5-91ad-29a3b5c9536e') THEN
    RAISE EXCEPTION 'guet_batch_manifest_invalid';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.place_location_checks'::regclass
      AND conname='place_location_checks_cartographic_source') THEN
    RAISE EXCEPTION 'guet_batch_requires_migration_0092';
  END IF;

  -- Lock every target before checking names, publication or coordinates. Normal
  -- staff validation takes this same place lock, so it cannot race this batch.
  PERFORM p.id FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
    ORDER BY p.id FOR UPDATE OF p;
  IF (SELECT count(*) FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id)<>100
    OR EXISTS(SELECT 1 FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
      WHERE NOT p.is_published OR p.name IS DISTINCT FROM t.expected_name OR p.lat IS NULL OR p.lng IS NULL
        OR NOT (
          (CASE WHEN t.serialized_float_tolerance
            THEN abs(p.lat-t.expected_lat)<=1e-10 AND abs(p.lng-t.expected_lng)<=1e-10
            ELSE p.lat=t.expected_lat AND p.lng=t.expected_lng END)
          OR (t.correct_coordinates AND p.lat=t.target_lat AND p.lng=t.target_lng)
        )) THEN
    RAISE EXCEPTION 'guet_batch_place_precondition_failed';
  END IF;
  PERFORM c.place_id FROM public.place_location_checks c
    JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=c.place_id
    ORDER BY c.place_id FOR UPDATE OF c;
  IF EXISTS(SELECT 1 FROM public.place_location_checks c
    JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=c.place_id
    JOIN public.places p ON p.id=t.place_id
    WHERE c.lat IS DISTINCT FROM CASE WHEN t.correct_coordinates THEN t.target_lat ELSE p.lat END
      OR c.lng IS DISTINCT FROM CASE WHEN t.correct_coordinates THEN t.target_lng ELSE p.lng END) THEN
    RAISE EXCEPTION 'guet_batch_existing_validation_conflict';
  END IF;

  WITH changes AS (
    SELECT p.id,p.lat old_lat,p.lng old_lng,p.updated_at old_updated_at,t.*
    FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
    WHERE t.correct_coordinates AND (p.lat<>t.target_lat OR p.lng<>t.target_lng)
  ), changed AS (
    UPDATE public.places p SET lat=c.target_lat,lng=c.target_lng FROM changes c WHERE p.id=c.id
    RETURNING p.id,p.lat,p.lng,p.updated_at,c.old_lat,c.old_lng,c.old_updated_at,
      c.source_url,c.source_sha256,c.source_checked_at
  ), journal AS (
    INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
    SELECT NULL,'places',id::text,
      jsonb_build_object('lat',old_lat,'lng',old_lng,'updated_at',old_updated_at),
      jsonb_build_object('lat',lat,'lng',lng,'updated_at',updated_at,
        'operation','cartographic_coordinate_correction','batch_id',batch_id,'batch_version',batch_version,
        'source_audit_sha256',source_audit_sha256,'source_url',source_url,'source_sha256',source_sha256,
        'source_checked_at',source_checked_at,'checked_at',validated_at)
    FROM changed RETURNING id
  ) SELECT count(*) INTO corrected_count FROM journal;

  -- Exact database coordinates are copied, including Le Kampement. The tiny
  -- serialization tolerance above is never used by the public eligibility view.
  WITH inserted AS (
    INSERT INTO public.place_location_checks(place_id,lat,lng,accuracy_meters,source,checked_at,checked_by)
    SELECT p.id,p.lat,p.lng,NULL,t.source_url,validated_at,NULL
    FROM public.places p JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id
    ON CONFLICT(place_id) DO NOTHING RETURNING *
  ), journal AS (
    INSERT INTO public.editorial_history(actor_id,entity_table,entity_key,before_value,after_value)
    SELECT NULL,'place_location_checks',i.place_id::text,NULL,
      to_jsonb(i)||jsonb_build_object('operation','cartographic_location_validation',
        'batch_id',batch_id,'batch_version',batch_version,'source_audit_sha256',source_audit_sha256,
        'source_sha256',t.source_sha256,'source_checked_at',t.source_checked_at)
    FROM inserted i JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=i.place_id
    RETURNING id
  ) SELECT count(*) INTO inserted_count FROM journal;

  -- A concurrent incompatible insert must fail the whole batch, never be
  -- silently accepted by ON CONFLICT. Existing compatible checks stay intact.
  IF EXISTS(SELECT 1 FROM public.place_location_checks c
    JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=c.place_id
    JOIN public.places p ON p.id=t.place_id
    WHERE c.lat IS DISTINCT FROM p.lat OR c.lng IS DISTINCT FROM p.lng) THEN
    RAISE EXCEPTION 'guet_batch_concurrent_validation_conflict';
  END IF;
  SELECT count(*) INTO eligible_count FROM public.public_guet_places p
    JOIN pg_temp.guet_cartography_targets_20261031 t ON t.place_id=p.id;
  IF eligible_count<>100 THEN RAISE EXCEPTION 'guet_batch_not_all_targets_eligible: %',eligible_count; END IF;
  RETURN jsonb_build_object('batch_id',batch_id,'batch_version',batch_version,
    'source_audit_sha256',source_audit_sha256,'checked_at',validated_at,
    'target_count',100,'inserted_checks',inserted_count,'retained_checks',100-inserted_count,
    'corrected_places',corrected_count,'eligible_targets',eligible_count,
    'eligible_total',(SELECT count(*) FROM public.public_guet_places));
END $$;

\if :guet_cartography_recipe_only
\else
  SELECT pg_temp.apply_guet_cartography_20261031() AS guet_cartography_receipt;
  COMMIT;
\endif
