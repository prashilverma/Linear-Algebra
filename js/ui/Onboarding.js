export class Onboarding {
  constructor(root) {
    this.root = root;
    this.dismissButton = document.getElementById("dismiss-onboarding");
    this.storageKey = "topography-onboarding-seen";
  }

  attach() {
    this.dismissButton.addEventListener("click", () => this.hide(true));
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) {
        this.hide(true);
      }
    });
  }

  shouldShow() {
    try {
      return window.localStorage.getItem(this.storageKey) !== "true";
    } catch {
      return true;
    }
  }

  show() {
    this.root.classList.remove("hidden");
  }

  hide(markSeen = false) {
    if (markSeen) {
      try {
        window.localStorage.setItem(this.storageKey, "true");
      } catch {
        // Ignore storage errors and continue.
      }
    }

    this.root.classList.add("hidden");
  }
}

export default Onboarding;
