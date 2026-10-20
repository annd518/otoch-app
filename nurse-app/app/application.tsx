import { BadgeCheck } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { Button } from "../components/Button";
import { DistrictPicker } from "../components/DistrictPicker";
import { ErrorBox } from "../components/ErrorBox";
import { Field } from "../components/Field";
import { FormSection, Intro, Surface, TaskBody } from "../components/Presentation";
import { theme } from "../design/theme";
import {
  DOCUMENT_KINDS,
  DOCUMENT_LABEL,
  STATE_TEXT,
  detailsFromForm,
  fetchApplication,
  saveApplication,
  submitApplication,
  uploadDocument,
  type Application,
  type DetailsForm,
  type DocumentKind,
} from "../services/application";
import { http } from "../services/http";
import { districtsText } from "../utils/districts";

// Registration application (spec N-01): details + four document photos, sent
// to the admin. The admin verifies it in the admin web; only then do orders come.

// Re-encoded to JPEG (the server accepts JPEG/PNG only; iOS would otherwise
// hand over HEIC). Same options as the family app's referral photos.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.8,
  allowsEditing: false,
  exif: false,
  base64: false,
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

// A scanned licence or diploma often is a PDF (spec N-01: зураг/PDF). Files are
// sent as they are, so only types the server accepts can be chosen.
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const toForm = (a: Application): DetailsForm => ({
  name: a.name,
  licenseNo: a.licenseNo ?? "",
  licenseExpiresAt: a.licenseExpiresAt ?? "",
  employer: a.employer ?? "",
  experienceYears: a.experienceYears === null ? "" : String(a.experienceYears),
  districts: a.districts,
});

export default function ApplicationScreen() {
  const [app, setApp] = useState<Application | null>(null);
  const [form, setForm] = useState<DetailsForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DetailsForm, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<DocumentKind | null>(null);
  const [progress, setProgress] = useState(0);

  const show = useCallback((a: Application, resetForm: boolean) => {
    setApp(a);
    if (resetForm) setForm(toForm(a));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchApplication(http).then((r) => {
        if (r.ok) show(r.data, true);
        else setMessage(r.message);
      });
    }, [show]),
  );

  const setDistricts = (districts: string[]) => {
    setForm((f) => (f ? { ...f, districts } : f));
    setErrors((e) => ({ ...e, districts: undefined }));
    setNotice(null);
  };

  const set = (key: Exclude<keyof DetailsForm, "districts">) => (value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setNotice(null);
  };

  /** Saves the form; true when it was saved. */
  async function save(): Promise<boolean> {
    if (!form) return false;
    const parsed = detailsFromForm(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return false;
    }
    const r = await saveApplication(http, parsed.details);
    if (!r.ok) {
      setMessage(r.message);
      return false;
    }
    show(r.data, true);
    return true;
  }

  async function onSave() {
    setBusy(true);
    setMessage(null);
    if (await save()) setNotice("Хадгалагдлаа");
    setBusy(false);
  }

  async function onSubmit() {
    setBusy(true);
    setMessage(null);
    setNotice(null);
    if (await save()) {
      const r = await submitApplication(http);
      if (r.ok) {
        show(r.data, true);
        setNotice("Өргөдөл админд илгээгдлээ");
      } else setMessage(r.message);
    }
    setBusy(false);
  }

  async function send(kind: DocumentKind, file: { uri: string; name: string; type: string }) {
    setUploading(kind);
    setProgress(0);
    const r = await uploadDocument(http, kind, file, setProgress);
    if (r.ok) show(r.data, false);
    else setMessage(r.message);
    setUploading(null);
  }

  async function pickFile(kind: DocumentKind) {
    setMessage(null);
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: FILE_TYPES,
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    if (a.size !== undefined && a.size > MAX_FILE_BYTES) {
      setMessage("Файл 10 MB-аас их байна.");
      return;
    }
    await send(kind, {
      uri: a.uri,
      name: a.name,
      type: a.mimeType ?? "application/pdf",
    });
  }

  async function pick(kind: DocumentKind, source: "camera" | "library") {
    setMessage(null);
    setNotice(null);
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setMessage(
          permission.canAskAgain
            ? "Зураг авахын тулд камерын зөвшөөрөл хэрэгтэй."
            : "Камерын зөвшөөрлийг утасны тохиргооноос нээнэ үү.",
        );
        return;
      }
    }
    // The system photo picker needs no library permission.
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await send(kind, {
      uri: asset.uri,
      name: asset.fileName ?? `${kind.toLowerCase()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    });
  }

  const status = app ? STATE_TEXT[app.state] : null;
  const statusColor =
    app?.state === "VERIFIED"
      ? { fg: theme.color.success, bg: theme.color.successBg }
      : app?.state === "REJECTED" || app?.state === "SUSPENDED"
        ? { fg: theme.color.error, bg: theme.color.errorBg }
        : { fg: theme.color.warning, bg: theme.color.warningBg };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }} edges={["bottom"]}>
      <Stack.Screen
        options={{ headerShown: true, title: "Бүртгэлийн өргөдөл", headerBackTitle: "Буцах" }}
      />
      {!app || !form || !status ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
          {message ? <ErrorBox message={message} /> : <ActivityIndicator color={theme.color.brand} />}
        </View>
      ) : (
        <TaskBody
          footer={
            app.editable ? (
              <View style={{ gap: theme.space[2] }}>
                <Button
                  label="Админд илгээх"
                  loading={busy}
                  disabled={uploading !== null}
                  onPress={() => void onSubmit()}
                />
                <Button
                  label="Хадгалах"
                  variant="secondary"
                  disabled={busy || uploading !== null}
                  onPress={() => void onSave()}
                />
              </View>
            ) : undefined
          }
        >
          <Surface style={{ backgroundColor: statusColor.bg, gap: theme.space[1] }}>
            <Intro title={status.title} description={status.body} icon={BadgeCheck} />
            {app.reviewNote ? (
              <AppText variant="label" color={statusColor.fg}>
                Шалтгаан: {app.reviewNote}
              </AppText>
            ) : null}
          </Surface>

          {app.editable && app.missing.length > 0 ? (
            <AppText variant="caption" color={theme.color.secondary}>
              Дутуу: {app.missing.join(", ")}
            </AppText>
          ) : null}
          {notice ? (
            <AppText variant="label" color={theme.color.success}>
              {notice}
            </AppText>
          ) : null}
          {message ? <ErrorBox message={message} /> : null}

          <FormSection title="Мэдээлэл">
            {app.editable ? (
              <>
                <Field label="Овог нэр" value={form.name} onChangeText={set("name")} error={errors.name} maxLength={100} />
                <Field
                  label="Мэргэжлийн зөвшөөрлийн дугаар"
                  value={form.licenseNo}
                  onChangeText={set("licenseNo")}
                  error={errors.licenseNo}
                  autoCapitalize="characters"
                  maxLength={40}
                />
                <Field
                  label="Зөвшөөрөл дуусах огноо"
                  unit="ОООО-СС-ӨӨ"
                  placeholder="2028-05-31"
                  keyboardType="numbers-and-punctuation"
                  value={form.licenseExpiresAt}
                  onChangeText={set("licenseExpiresAt")}
                  error={errors.licenseExpiresAt}
                  maxLength={10}
                />
                <Field
                  label="Ажлын газар (одоогийн эсвэл сүүлийн)"
                  value={form.employer}
                  onChangeText={set("employer")}
                  error={errors.employer}
                  maxLength={200}
                />
                <Field
                  label="Сувилагчаар ажилласан жил"
                  keyboardType="number-pad"
                  value={form.experienceYears}
                  onChangeText={(v) => set("experienceYears")(v.replace(/\D/g, ""))}
                  error={errors.experienceYears}
                  maxLength={2}
                />
                <View style={{ gap: theme.space[1] }}>
                  <AppText variant="label">Ажиллах дүүрэг (хэдийг ч сонгож болно)</AppText>
                  <AppText variant="caption" color={theme.color.secondary}>
                    Зөвхөн эдгээр дүүргээс дуудлага ирнэ. Дараа нь профайлаас өөрчилж болно.
                  </AppText>
                  <DistrictPicker value={form.districts} onChange={setDistricts} />
                  {errors.districts ? (
                    <AppText variant="caption" color={theme.color.error}>
                      {errors.districts}
                    </AppText>
                  ) : null}
                </View>
              </>
            ) : (
              <View style={{ gap: theme.space[1] }}>
                <AppText>{app.name}</AppText>
                <AppText color={theme.color.secondary}>
                  Зөвшөөрөл №{app.licenseNo ?? "—"} · {app.licenseExpiresAt ?? "—"} хүртэл
                </AppText>
                <AppText color={theme.color.secondary}>
                  {app.employer ?? "—"} · {app.experienceYears ?? "—"} жил
                </AppText>
                <AppText color={theme.color.secondary}>
                  Дүүрэг: {districtsText(app.districts)}
                </AppText>
              </View>
            )}
          </FormSection>

          <FormSection title="Баримтын зураг">
            <AppText variant="caption" color={theme.color.secondary}>
              Зураг эсвэл PDF файл. Тод, бүтэн харагдах ёстой. Зөвхөн админ харна.
            </AppText>
            {DOCUMENT_KINDS.map((kind) => {
              const done = app.documents[kind] !== null;
              return (
                <View
                  key={kind}
                  style={{
                    gap: theme.space[2],
                    padding: theme.space[3],
                    borderRadius: theme.radius.card,
                    borderWidth: 1,
                    borderColor: done ? theme.color.success : theme.color.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: theme.space[2] }}>
                    <AppText variant="label" style={{ flex: 1 }}>
                      {DOCUMENT_LABEL[kind]}
                    </AppText>
                    <AppText variant="caption" color={done ? theme.color.success : theme.color.secondary}>
                      {uploading === kind
                        ? `Илгээж байна ${Math.round(progress * 100)}%`
                        : done
                          ? "✓ Оруулсан"
                          : "Оруулаагүй"}
                    </AppText>
                  </View>
                  {app.editable ? (
                    <View style={{ flexDirection: "row", gap: theme.space[2] }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Камер"
                          variant="secondary"
                          disabled={uploading !== null || busy}
                          onPress={() => void pick(kind, "camera")}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Зураг"
                          variant="secondary"
                          disabled={uploading !== null || busy}
                          onPress={() => void pick(kind, "library")}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="PDF"
                          variant="secondary"
                          disabled={uploading !== null || busy}
                          onPress={() => void pickFile(kind)}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </FormSection>
        </TaskBody>
      )}
    </SafeAreaView>
  );
}
